// !minifyOnSave
"use strict";

var async = require("async");
var chalk = require("chalk");
var fs = require("fs");
var inquirer = require("inquirer");
var parseString = require("xml2js").parseString;
var path = require("path");
var progress = require("progress");
var request = require("request");
var cursor = require('ansi')(process.stdout)

// TODO: improved error handling
// TODO: Process TV libraries
// TODO: Process Music libraries
// TODO: Process Photo libraries

// modify this value to allow multiple concurrent API requests
// note: sending too many requests concurrently has been found to
//       cause Plex to become unresponsive.
var throttle = 5;

var questions = {
  configquestions: [
    {
      type: "input",
      name: "address",
      message: "Plex Address",
      default: "127.0.0.1",
      validate: function(input){
        // TODO: improve address validation
        var ipPattern = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
        var arrMatches = input.match(ipPattern);
        if(arrMatches === null){
          return "Please enter a valid IPv4 Address";
        }

        return true;
      }
    },
    {
      type: "input",
      name: "port",
      message: "Port",
      default: "32400",
      validate: function(input){
        if(isNaN(parseInt(input))){
          return "Please enter a valid port number";
        }
        return true;
      }
    }
  ],
  libraryquestions: [
    {
      type: "confirm",
      name: "processLibrary",
      message: "Do you want to process this library?",
      default: true
    },
    {
      type: "confirm",
      name: "overwriteExisting",
      message: "Overwrite existing files?",
      default: false,
      when: function(answers){
        return answers.processLibrary;
      }
    },
    {
      type: "confirm",
      name: "savemeta",
      message: "Save metadata alongside each media file?",
      default: true,
      when: function(answers){
        return answers.processLibrary;
      }
    },
    {
      type: "confirm",
      name: "savethumbs",
      message: "Save thumbnail alongside each media file?",
      default: true,
      when: function(answers){
        return answers.processLibrary;
      }
    },
    {
      type: "confirm",
      name: "saveart",
      message: "Save artwork alongside each media file?",
      default: true,
      when: function(answers){
        return answers.processLibrary;
      }
    }
  ],
  movielibraryquestions: [
    {
      type: "confirm",
      name: "saveart",
      message: "Save artwork alongside each media file?",
      default: true,
      when: function(answers){
        return answers.processLibrary;
      }
    },
    {
      type: "confirm",
      name: "moviesinownfolder",
      message: "Are all movies in their own folder?",
      default: true,
      when: function(answers){
        return answers.processLibrary;
      }
    },
    {
      type: "confirm",
      name: "savefolderposter",
      message: "Save poster.jpg from thumbnail into containing folder?",
      default: true,
      when: function(answers){
        return answers.processLibrary && answers.moviesinownfolder
      }
    },
    {
      type: "confirm",
      name: "savefolderthumb",
      message: "Save folder.jpg from thumbnail into containing folder?",
      when: function(answers){
        return answers.processLibrary && answers.moviesinownfolder
      }
    },
    {
      type: "confirm",
      name: "savefolderart",
      message: "Save art.jpg from artwork into containing folder?",
      when: function(answers){
        return answers.processLibrary && answers.moviesinownfolder
      }
    }

  ],
  tvlibraryquestions: [
    {
      type: "confirm",
      name: "saveartonpreviousmatch",
      message: "Save artwork alongside each media file, even when its the same as the series artwork?",
      default: true,
      when: function(answers){
        return answers.processLibrary && answers.saveart;
      }
    },
    {
      type: "confirm",
      name: "tvseriesinownfolder",
      message: "Are all TV Series in their own folder?",
      default: true,
      when: function(answers){
        return answers.processLibrary;
      }
    },
    {
      type: "confirm",
      name: "saveseriesmeta",
      message: "Save metadata for series into the Series folder?",
      when: function(answers){
        return answers.processLibrary && answers.tvseriesinownfolder;
      }
    },
    {
      type: "confirm",
      name: "saveseriesposter",
      message: "Save poster.jpg from thumbnail into the Series folder?",
      default: true,
      when: function(answers){
        return answers.processLibrary && answers.tvseriesinownfolder;
      }
    },
    {
      type: "confirm",
      name: "saveseriesfolderthumb",
      message: "Save folder.jpg from thumbnail into the Series folder?",
      when: function(answers){
        return answers.processLibrary && answers.tvseriesinownfolder;
      }
    },
    {
      type: "confirm",
      name: "saveseriesfolderart",
      message: "Save art.jpg from artwork into the Series folder?",
      when: function(answers){
        return answers.processLibrary && answers.tvseriesinownfolder;
      }
    },
    {
      type: "confirm",
      name: "tvseasonsinownfolder",
      message: "Are all Seasons in their own sub folder?",
      default: true,
      when: function(answers){
        return answers.processLibrary && answers.tvseriesinownfolder;
      }
    },
    {
      type: "confirm",
      name: "saveseasonmeta",
      message: "Save metadata for season into the Season folder?",
      when: function(answers){
        return answers.processLibrary && answers.tvseriesinownfolder && answers.tvseasonsinownfolder;
      }
    },
    {
      type: "confirm",
      name: "saveseasonposter",
      message: "Save poster.jpg from thumbnail into the Season folder?",
      default: true,
      when: function(answers){
        return answers.processLibrary && answers.tvseriesinownfolder;
      }
    },
    {
      type: "confirm",
      name: "saveseasonfolderthumb",
      message: "Save folder.jpg from thumbnail into the Season folder?",
      when: function(answers){
        return answers.processLibrary && answers.tvseriesinownfolder;
      }
    },
  ]
}

var configurationMode = false;

var config = {}, libraries = {};

var totalactions = 0;

var discoveryprogress = new progress(
  chalk.bgBlue(" INFO ") + " Discovered " + chalk.bold(":discovered") + " items",
  {
    width: 5,
    total: 1,
    complete: ".",
    incomplete: " "
  }
);

var processingprogress = new progress(
  chalk.bgBlue(" INFO ") + " Saving metadata " + chalk.bold("[:bar]") + " :percent :etas",
  {
    complete: "=",
    incomplete: " ",
    width: 20,
    total: 1,
  }
)

var discoveryqueue = async.queue(function(task, callback){
  cursor.hide();
  if(task.message)
    console.log(task.message);

  task.execute(function(){

    // increment discoveryprogress so that it never ends!
    discoveryprogress.total++;
    discoveryprogress.tick({discovered: totalactions});
    callback();
  });
}, throttle);

discoveryqueue.drain = function(){
  //console.log(chalk.bgBlue(" INFO ") + " Discovered " + chalk.bold(totalactions) + " save actions.");
  console.log("");
  if(totalactions <= 0){
    done();
  } else {
    processingprogress.total = processingqueue.length();
    processingqueue.resume();
  }
}

var processingqueue = async.queue(function(task, callback){
  task.execute(function(){
    processingprogress.tick({message: task.message});
    callback();
  });
}, throttle);
processingqueue.pause();
processingqueue.drain = function(){
  done();
}

function done(){
  console.log (chalk.bgGreen.black(" Done ") + " Finished exporting metadata! ");
  cursor.show();
}

function loadConfiguration(){
  var configstring = '';
  if(fs.existsSync('config.json'))
    configstring = fs.readFileSync('config.json');

  if(configstring != ''){
    config = JSON.parse(configstring);
  }else{
    console.log(chalk.bgYellow.black(" WARN ") + chalk.bold(' No configuration settings found!'));
    configurationMode = true;
  }
}

function loadLibraries(){
  var librariesstring = ''
  if(fs.existsSync('libraries.json'))
    librariesstring = fs.readFileSync('libraries.json');

  if(librariesstring != ''){
    libraries = JSON.parse(librariesstring);
  }
}

function saveConfiguration(configjson){
  fs.writeFile('config.json', JSON.stringify(configjson, null, "  "), function(err){
    if(err)
      console.log(chalk.brRed(" ERR  ") + " " + err);

    console.log(chalk.bgBlue(" INFO ") + " Configuration saved!");
  });
}

function saveLibraryConfiguration(libraryjson){
  fs.writeFile('libraries.json', JSON.stringify(libraryjson, null, "  "), function(err){
    if(err)
      console.log(chalk.brRed(" ERR  ") + " " + err);

    console.log(chalk.bgBlue(" INFO ") + " Library configuration saved!");
  });
}

function doScrape(){
  var rootaddr = "http://" + config.address + ":" + config.port;

  console.log(chalk.bgBlue(" INFO ") + chalk.bold(" Discovering Libraries"));
  makeGetRequest(rootaddr + '/library/sections', function(response, body){
    parseString(body, function(error, data){
      var libs = [];
      var libraryconfigupdated = false;
      async.each(data.MediaContainer.Directory, function(discoveredlibrary, itemcallback){
        libs.push({key: discoveredlibrary.$.key, title: discoveredlibrary.$.title, type: discoveredlibrary.$.type});
      });
      async.eachSeries(libs, function(lib, itemcallback){
        if(!libraries[lib.key]){
          libraryconfigupdated = true;
          console.log(chalk.bgBlue(" INFO ") + " New library discovered " + chalk.bold("\"" + lib.title + "\""));
          var thislibquestions = questions.libraryquestions.slice();
          switch(lib.type){
            case "movie":
              thislibquestions = thislibquestions.concat(questions.movielibraryquestions);
              break;
            case "show":
              //thislibquestions = thislibquestions.concat(questions.tvlibraryquestions);
              break;
          }
          inquirer.prompt(thislibquestions, function(answers){
            libraries[lib.key] = answers;
            itemcallback();
          });
        }else{
          itemcallback();
        }
      }, function(error){
        if(error)
          console.log(chalk.bgRed(" ERR  ") + " " + error);
          if(libraryconfigupdated){
            console.log(chalk.bgBlue(" INFO ") + " Library configuration changed");
            inquirer.prompt([{type: "confirm", name: "saveLibraryConfig", message: "Save library configuration?", default: true}],
            function(answers){
              if(answers.saveLibraryConfig){
                saveLibraryConfiguration(libraries);
              }
              async.each(libs, function(lib, itemcallback){

                  if(libraries[lib.key].processLibrary){
                    processLibrary(rootaddr, lib.key, lib.type, lib.title);
                  }
                  itemcallback();
              });
            });
          }else{
            async.each(libs, function(lib, itemcallback){

                if(libraries[lib.key].processLibrary){
                  processLibrary(rootaddr, lib.key, lib.type, lib.title);
                }
                itemcallback();
            });
          }
      });

    });
  }, function(error){
    console.log(chalk.bgRed.white(" Err  ") + " " + error);
  });
}

function processLibrary(rootaddr, librarykey, librarytype, libraryname){
  switch(librarytype){
    case "movie":
      makeGetRequestDiscovery(rootaddr + "/library/sections/" + librarykey + "/all", function(response, body){
        parseString(body, function(error, data){
          async.each(data.MediaContainer.Video, function(video, itemcallback){
            processMovie(rootaddr, video.$.key);
            itemcallback();
          });
        })
      });
      break;
    case "show":
      break;
      makeGetRequestDiscovery(rootaddr + "library/sections/" + librarykey + "/all", function(response, body){
        parseString(body, function(error, data){
          async.each(data.MediaContainer.Directory, function(directory, itemcallback){
            processSeries(rootaddr, directory.$.key);
            itemcallback();
          });
        })
      });
  }
}

function processMovie(rootaddr, url){

  makeGetRequestDiscovery(rootaddr + url, function(response, body){
    parseString(body, function(error, data){
      var sectionid = data.MediaContainer.$.librarySectionID;
      async.each(data.MediaContainer.Video, function(video, itemcallback){
        var videokey = video.$.key;
        var videotitle = video.title;
        var thumburl = video.$.thumb;
        var arturl = video.$.art;
        totalactions++;
        async.each(video.Media, function(media, mediaitemcallback){
          if(!media.$.target){
            async.each(media.Part, function(part, partitemcallback){
              var parentpath = path.dirname(part.$.file)
              if(libraries[sectionid].savemeta){
                if(!fs.existsSync(part.$.file + ".meta.xml") || libraries[sectionid].overwriteExisting){
                  downloadmetadata(rootaddr + videokey, part.$.file + ".meta.xml");
                }
              }
              if(libraries[sectionid].savethumbs){
                if(!fs.existsSync(part.$.file + ".thumb.jpg") || libraries[sectionid].overwriteExisting){
                  downloadfile(rootaddr + thumburl, part.$.file + ".thumb.jpg");
                }
              }
              if(libraries[sectionid].savethumbs){
                if(!fs.existsSync("folder.jpg") || libraries[sectionid].overwriteExisting){
                  downloadfile(rootaddr + thumburl, path.join(parentpath, "folder.jpg"));
                }
              }
              if(libraries[sectionid].savethumbs){
                if(!fs.existsSync(path.join(parentpath, "poster.jpg")) || libraries[sectionid].overwriteExisting){
                  downloadfile(rootaddr + thumburl, path.join(parentpath, "poster.jpg"));
                }
              }
              if(libraries[sectionid].saveart){
                if(!fs.existsSync(part.$.file + '.art.jpg') || libraries[sectionid].overwriteExisting){
                  downloadfile(rootaddr + arturl, part.$.file + ".art.jpg");
                }
              }
              if(libraries[sectionid].savefolderart){
                if(!fs.existsSync(path.join(parentpath, "art.jpg")) || libraries[sectionid].overwriteExisting){
                  downloadfile(rootaddr + arturl, path.join(parentpath, "art.jpg"));
                }
              }
              partitemcallback();
            });
          }
          mediaitemcallback();
        });
        itemcallback();
      });
    });
  });
}

function processSeries(rootaddr, url){
  totalactions++;
}

function downloadmetadata(url, filepath){
  var task = {
    message: "",
    execute: function(callback){
      request(url, function(error, response, body){
        if(!error && response.statusCode == 200){
          fs.writeFile(filepath, body);
          callback();
        }else{
          if(error){
            if(errorcallback)
              // TODO: improved error handling
              callback();
          }else{
            // TODO: process additional response codes
            callback();
          }
        }
      });
    }
  };
  processingqueue.push(task);
}

function downloadfile(url, filepath){
  var task = {
    message: "",
    execute: function(callback){
      request(url).pipe(fs.createWriteStream(filepath)).on('close', function(){
        callback();
      });
    }
  };
  processingqueue.push(task);
}

function makeGetRequest(url, successcallback, errorcallback){
  request(url, function(error, response, body){
    if(!error && response.statusCode == 200){
      successcallback(response, body);
    }else{
      if(error){
        if(errorcallback)
          errorcallback(error);
      }else{
        // TODO: process additional response codes
      }
    }
  });
}
function makeGetRequestDiscovery(url, successcallback, errorcallback){

  var task = {
    message: null,
    execute: function(callback){
      request(url, function(error, response, body){
        if(!error && response.statusCode == 200){
          successcallback(response, body);
          callback();
        }else{
          if(error){
            if(errorcallback)
              errorcallback(error);
              callback();
          }else{
            // TODO: process additional response codes
            callback();
          }
        }
      });
    }
  };
  discoveryqueue.push(task);
}

// load from saved settings when available
loadConfiguration();
loadLibraries();

// process command line and build configuration object
process.argv.forEach(function (val, index, array) {
  if(val == '--configure'){
    // enter configuration module
    configurationMode = true;
  }
});

// configuration mode - read settings from user input
if(configurationMode){
  console.log(chalk.bgBlue(" INFO ") + chalk.bold(" Entering configuration mode for PlexMetadataExtractor"))
  inquirer.prompt(questions.configquestions, function(answers){
    saveConfiguration(answers);
    config = answers;
    doScrape();
  });
}else{
  doScrape();
}
