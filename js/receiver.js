/*
Copyright 2020 Google LLC. All Rights Reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

/**
 * This sample demonstrates how to build your own Receiver for use with Google
 * Cast.
 */

'use strict';

import { CastQueue } from './queuing.js';
import { AdsTracker, SenderTracker, ContentTracker } from './cast_analytics.js';

/**
 * Constants to be used for fetching media by entity from sample repository.
 */
const ID_REGEX = '\/?([^\/]+)\/?$';
const CONTENT_URL = 
  'https://storage.googleapis.com/cpe-sample-media/content.json';

const context = cast.framework.CastReceiverContext.getInstance();

const CUSTOM_CHANNEL = 'urn:x-cast:com.ciderapp.customdata';
context.addCustomMessageListener(CUSTOM_CHANNEL, function(customEvent) {
  // handle customEvent.
  castDebugLogger.info('customMsg', customEvent);
  if (customEvent?.data?.ip != null){
    setupWS(customEvent.data.ip);
  }
  if (customEvent?.data?.action != null){
    switch (customEvent.data.action){
      case "play":
        play();
        break;
      case "pause":
        pause();
        break;
      case "next":
        next();
        break;
      case "previous":
        previous();
        break;
      case "setMetadata":
        setMetadata(customEvent.data.metadata);
        break;
      case "stop":
        context.stop(); 
        break; 
      case "sendChunkedMp3Audio":
        sendChunkedMp3Audio(customEvent.data.audio);
        break;
    }
  }
});
const playerManager = context.getPlayerManager();


const LOG_RECEIVER_TAG = 'Receiver';
var WebSocketIP = null;

/**
 * Debug Logger
 */
const castDebugLogger = cast.debug.CastDebugLogger.getInstance();

/**
 * WARNING: Make sure to turn off debug logger for production release as it
 * may expose details of your app.
 * Uncomment below line to enable debug logger, show a 'DEBUG MODE' tag at
 * top left corner and show debug overlay.
 */
 context.addEventListener(cast.framework.system.EventType.READY, () => {
  if (!castDebugLogger.debugOverlayElement_) {
    // /**
    //  *  Enable debug logger and show a 'DEBUG MODE' tag at
    //  *  top left corner.
    //  */
    //   castDebugLogger.setEnabled(true);

    // /**
    //  * Show debug overlay.
    //  */
    //   castDebugLogger.showDebugLogs(true);
  }
});

/**
 * Set verbosity level for Core events.
 */
castDebugLogger.loggerLevelByEvents = {
  'cast.framework.events.category.CORE':
    cast.framework.LoggerLevel.INFO,
  'cast.framework.events.EventType.MEDIA_STATUS':
    cast.framework.LoggerLevel.DEBUG
};

if (!castDebugLogger.loggerLevelByTags) {
  castDebugLogger.loggerLevelByTags = {};
}

/**
 * Set verbosity level for custom tag.
 * Enables log messages for error, warn, info and debug.
 */
castDebugLogger.loggerLevelByTags[LOG_RECEIVER_TAG] =
  cast.framework.LoggerLevel.DEBUG;

/**
 * Example of how to listen for events on playerManager.
 */
playerManager.addEventListener(
  cast.framework.events.EventType.ERROR, (event) => {
    castDebugLogger.error(LOG_RECEIVER_TAG,
      'Detailed Error Code - ' + event.detailedErrorCode);
    if (event && event.detailedErrorCode == 905) {
      castDebugLogger.error(LOG_RECEIVER_TAG,
        'LOAD_FAILED: Verify the load request is set up ' +
        'properly and the media is able to play.');
    }
});

/**
 * Example analytics tracking implementation. See cast_analytics.js. Must
 * complete TODO item in google_analytics.js.
 */
const adTracker = new AdsTracker();
const senderTracker = new SenderTracker();
const contentTracker = new ContentTracker();
// adTracker.startTracking();
// senderTracker.startTracking();
// contentTracker.startTracking();

/**
 * Adds an ad to the beginning of the desired content.
 * @param {cast.framework.messages.MediaInformation} mediaInformation The target
 * mediainformation. Usually obtained through a load interceptor.
 */
function addBreaks(mediaInformation) {
  castDebugLogger.debug(LOG_RECEIVER_TAG, "addBreaks: " +
    JSON.stringify(mediaInformation));
  return fetchMediaById('fbb_ad')
  .then((clip1) => {
  //   mediaInformation.breakClips = [
  //     {
  //       id: 'fbb_ad',
  //       title: clip1.title,
  //       contentUrl: clip1.stream.dash,
  //       contentType: 'application/dash+xml',
  //       whenSkippable: 5
  //     }
  //   ];

  //   mediaInformation.breaks = [
  //     {
  //       id: 'pre-roll',
  //       breakClipIds: ['fbb_ad'],
  //       position: 0
  //     }
  //   ];
  });
}

/**
 * Obtains media from a remote repository.
 * @param  {Number} Entity or ID that contains a key to media in JSON hosted
 * by CONTENT_URL.
 * @return {Promise} Contains the media information of the desired entity.
 */
function fetchMediaById(id) {
  castDebugLogger.debug(LOG_RECEIVER_TAG, "fetching id: " + id);

  return new Promise((accept, reject) => {
    fetch(CONTENT_URL)
    .then((response) => response.json())
    .then((obj) => {
      if (obj) {
        if (obj[id]) {
          accept(obj[id]);
        }
        else {
          reject(`${id} not found in repository`);
        }
      }
      else {
        reject('Content repository not found.');
      }
    });
  });
}




const playbackConfig = new cast.framework.PlaybackConfig();

/**
 * Set the player to start playback as soon as there are five seconds of
 * media content buffered. Default is 10.
 */
playbackConfig.autoResumeDuration = 5;
castDebugLogger.info(LOG_RECEIVER_TAG,
  `autoResumeDuration set to: ${playbackConfig.autoResumeDuration}`);

/**
 * Set the control buttons in the UI controls.
 */
const controls = cast.framework.ui.Controls.getInstance();
controls.clearDefaultSlotAssignments();

// /**
//  * Assign buttons to control slots.
//  */
controls.assignButton(
  cast.framework.ui.ControlsSlot.SLOT_PRIMARY_1,
  cast.framework.ui.ControlsButton.QUEUE_PREV
);
// controls.assignButton(
//   cast.framework.ui.ControlsSlot.SLOT_PRIMARY_1,
//   cast.framework.ui.ControlsButton.CAPTIONS
// );
// controls.assignButton(
//   cast.framework.ui.ControlsSlot.SLOT_PRIMARY_2,
//   cast.framework.ui.ControlsButton.SEEK_FORWARD_15
// );
controls.assignButton(
  cast.framework.ui.ControlsSlot.SLOT_PRIMARY_2,
  cast.framework.ui.ControlsButton.QUEUE_NEXT
);

context.start({
  queue: new CastQueue(),
  playbackConfig: playbackConfig,
  supportedCommands: cast.framework.messages.Command.ALL_BASIC_MEDIA |
                      cast.framework.messages.Command.QUEUE_PREV |
                      cast.framework.messages.Command.QUEUE_NEXT |
                      cast.framework.messages.Command.STREAM_TRANSFER,
    useShakaForHls: true
});
var socket;
function play() {
  socket.send(JSON.stringify({
      action: "play"
  }))
}
function pause() {
  socket.send(JSON.stringify({
      action: "pause"
  }))
}
function next() {
  socket.send(JSON.stringify({
      action: "next"
  }))
}
function previous() {
  socket.send(JSON.stringify({
      action: "previous"
  }))
}

playerManager.setMessageInterceptor(
  cast.framework.messages.MessageType.QUEUE_UPDATE, (data) => {
    if (socket != null){
      if (data.jump = 1) {
        next();
      } else if (data.jump = -1) {
        previous();
      }
    }
    return null;
});
playerManager.setMessageInterceptor(cast.framework.messages.MessageType.PAUSE, data => {
  if (socket != null){
     pause();
  }
  return data;
})
playerManager.setMessageInterceptor(cast.framework.messages.MessageType.PLAY, data => {
  if (socket != null){
     play();
  }
  return data;
})
playerManager.setMessageInterceptor(
    cast.framework.messages.MessageType.LOAD, loadRequestData => {
      loadRequestData.media.hlsSegmentFormat = cast.framework.messages.HlsSegmentFormat.MP3;
      return loadRequestData;
});

function setupWS(url){
  socket = new WebSocket(url);
  socket.onopen = (e) => {
      // console.log(e);
      // console.log('connected');
      // app.connectedState = 1;
      // if (getParameterByName("mode")) {
      //     self.setMode(getParameterByName("mode"))
      // } else {
      //     self.setMode("default")
      // }
      // self.clearSelectedTrack()
  }

  socket.onclose = (e) => {
      // console.log(e);
      // console.log('disconnected');
      //app.connectedState = 2;
  }

  socket.onerror = (e) => {
      // console.log(e);
      // console.log('error');
      //app.connectedState = 2;
  }

  socket.onmessage = (e) => {
     // castDebugLogger.info('customMsg', e.data);
      const response = JSON.parse(e.data);
      switch (response.type) {
          default: 
          //castDebugLogger.info('customMsg', response);
          setMetadata(response.data);
          break;
          // case "musickitapi.search":
          //         self.showArtist(response.data["artists"][0]["id"]);
          //     break;
          // case "musickitapi.playlist":    
          // case "musickitapi.album":
          //         if (self.screen == "album-page") {
          //             self.albumPage.data = response.data
          //         }
          //     break;
          // case "musickitapi.artist":
          //         if (self.screen == "artist-page") {
          //             self.artistPage.data = response.data
          //         }
          //     break;
          // case "queue":
          //         self.player.queue = response.data;
          //     self.queue.temp = response.data["_queueItems"];
          //     self.$forceUpdate()
          //     break;
          // case "lyrics":
          //         self.player.lyrics = response.data;
          //     self.$forceUpdate()
          //     break;
          // case "searchResultsLibrary":
          //         self.search.results = response.data;
          //     self.search.state = 2;
          //     break;
          // case "searchResults":
          //         self.search.results = response.data;
          //     self.search.state = 2;
          //     break;
          // case "playbackStateUpdate":
          //         if (!self.player.userInteraction) {
          //             self.updatePlaybackState(response.data)
          //         }
          //     break;
          // case "maxVolume":
          //     this.player.maxVolume = response.data;
          //     break;
      }}
}

function setMetadata(res){
  let mediaInformation = playerManager.getMediaInformation();
   castDebugLogger.info('customMsg',mediaInformation.metadata);
  // castDebugLogger.info('cust', res);
 // [ 21.536s] [cast.debug.CastDebugLogger] [customMsg] {"type":0,"metadataType":3,"title":"Cider","albumName":"Test build","artist":"Playing ...","images":[{"url":""}]} 
 if (mediaInformation.metadata.title != res.name && mediaInformation.metadata.artist != res.artistName && mediaInformation.metadata.albumName != res.albumName) {
   
    mediaInformation.metadata.title = res.name;
    mediaInformation.metadata.artist = res.artistName;
    mediaInformation.metadata.albumName = res.albumName;
    let width = 1024;
    let height = 1024;
    mediaInformation.metadata.images = [{url: (res.artwork?.url ?? '').replace('{w}', width ?? height).replace('{h}', height).replace('{f}', "webp").replace('{c}', "").replace('1024x1024bb.','1024x1024.')}]; 
    playerManager.setMediaInformation(mediaInformation);}
}


// create a audio element with Media Source Extensions
let audio = new Audio();
audio.autoplay = true;
audio.controls = false;
let mediaSource = new MediaSource();
audio.src = URL.createObjectURL(mediaSource);
let sourceBuffer = mediaSource.addSourceBuffer('audio/mpeg');
function sendChunkedMp3Audio(chunk){
  if (mediaSource.readyState === 'open' && sourceBuffer && !sourceBuffer.updating) {
    let byteCharacters = atob(chunk);
    let byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    let byteArray = new Uint8Array(byteNumbers);
    sourceBuffer.appendBuffer(byteArray);
  }

  // play the audio
  if (!audio.paused ) return;
  audio.play().catch((error) => {
    console.error('Error playing audio:', error);
  });
}
