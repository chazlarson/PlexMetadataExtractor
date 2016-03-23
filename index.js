// !minifyOnSave

'use strict';

var async = require('async');
var fs = require('fs');
var path = require('path');
var request = require('request');
var parseString = require('xml2js').parseString;
var term = require('node-terminal');

var inquirer = require("inquirer");

var configquestions = [
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
  },
  {
    type: "confirm",
    name: "overwriteExisting",
    message: "Overwrite existing files?",
    default: false
  },
  {
    type: "confirm",
    name: "savemeta",
    message: "Save metadata alongside media files?",
    default: true
  },
  {
    type: "confirm",
    name: "savethumbs",
    message: "Save thumbnails alongside media files?",
    default: true
  },
  {
    type: "confirm",
    name: "saveart",
    message: "Save artwork alongside media files?",
    default: true
  },
  {
    type: "confirm",
    name: "savefolderposter",
    message: "Save poster to containing folder?",
    default: true
  },
  {
    type: "confirm",
    name: "savefolderart",
    message: "Save artwork to containing folder?",
    default: true
  },
  {
    type: "confirm",
    name: "savefolderthumb",
    message: "Save additional folder.jpg from thumb?",
    default: true
  }
];

var libraryquestions = [
  {
    type: "confirm",
    name: "processLibrary",
    message: "Do you want to process this library?",
    default: true
  }

]

// TODO: Decisions on items in own folder
// TODO: Improved progress output
// TODO: Improved config questionaire
// TODO: Arguments to override config
// TODO: Process TV Series Libraries
// TODO: Process Music Libraries
// TODO: Process Photo Libraries
// TODO: Save extra library info to allow more question asking
// TODO: Library specific configuration

var configurationMode = false;

var config = {};
var libraries = [];

// load the configuration
var configstring = '';
if(fs.existsSync('config.json'))
  configstring = fs.readFileSync('config.json');

if(configstring != ''){
  config = JSON.parse(configstring);
}else{
  console.log('No configuration settings found!');
  configurationMode = true;
}

// load any library configuration
var librariesstring = ''
if(fs.existsSync('libraries.json'))
  librariesstring = fs.readFileSync('libraries.json');

if(librariesstring != ''){
  libraries = JSON.parse(librariesstring);
}

function saveConfig(configjson){
  fs.writeFile('config.json', JSON.stringify(configjson), function(err){
    if(err != null)
      console.log(err);

    console.log('Configuration file saved!')
  });
}

// process command line and build configuration object
process.argv.forEach(function (val, index, array) {
  if(val == '--configure'){
    // enter configuration module
    configurationMode = true;
  }
});


// configuration mode - read settings from user input
if(configurationMode){
  inquirer.prompt(configquestions, function(answers){
    saveConfig(answers);
    config = answers;
    doScrape();
  });



}else{
  doScrape();
}

function doScrape(){
  // access PLEX API to discover metadata
  var rootaddr = 'http://' + config.address + ':' + config.port;
  request(rootaddr,
    function(error, response, body){
      // initial request to test server connection
      if(!error && response.statusCode == 200){

        console.log('Discovering Libraries');

        request(rootaddr + '/library/sections',
          function(error, response, body){
            if(!error && response.statusCode == 200){
              parseString(body, function(err,data){
                var libs = []
                for(var i=0;i<data.MediaContainer.Directory.length;i++){
                  //console.log('Discovered ' + data.MediaContainer.Directory[i].$.title + '...');
                  libs.push({key: data.MediaContainer.Directory[i].$.key, title: data.MediaContainer.Directory[i].$.title, type: data.MediaContainer.Directory[i].$.type});
                }
                async.eachSeries(libs, function(lib, itemcallback){
                  if(!libraries[lib.key]){
                    console.log("New library discoveed \"" + lib.title + "\"")
                    inquirer.prompt(libraryquestions, function(answers){
                      libraries[lib.key] = answers;
                      itemcallback();
                    });
                  }

                }, function(err){
                  if(err){
                    console.log(err);
                  }
                  async.each(libs, function(lib){

                    if(libraries[lib.key].processLibrary){
                      processLibrary(rootaddr, lib.key, lib.type, lib.title);
                    }
                  });
                });

              });
            }else{
              console.log('Failed to discover libraries, arborted!')
            }


          }
        )


      }else{
        console.log('Failed to connect to Plex on \"' + rootaddr + '\"');
        console.log('Metadata export aborted!');
      }
    }
  );
}

function processLibrary(rootaddr, librarykey, type, sectionname){
  request(rootaddr + '/library/sections/' + librarykey +'/all', function(error, response, body){
    if(!error && response.statusCode == 200){
      parseString(body, function(err, data){

        if(type == "movie"){

          for(var i=0;i<data.MediaContainer.$.size;i++){
            //console.log(data.MediaContainer.Directory[i])

              processMovie(rootaddr, data.MediaContainer.Video[i].$.key);

          }
        }else{
          console.log("Unfortunately Metadata Extractor is not designed to work with sections of type \"" + type + "\" yet.");
        }
      });
    }else{
      console.log("Failed to get section listing for " + sectionname + ' (' + librarykey + ')');
    }
  });
}

function processMovie(rootaddr, url){
  //console.log(url);

  var mediaurl = rootaddr + url;

  request(mediaurl, function(error, response, body){
    if(!error && response.statusCode == 200){
      parseString(body, function(err, data){
        if(data.MediaContainer.Video !== undefined)
          for(var i=0;i<data.MediaContainer.Video.length;i++){
            var videotitle = data.MediaContainer.Video[i].$.title;
            var thumburl = data.MediaContainer.Video[i].$.thumb;
            var arturl = data.MediaContainer.Video[i].$.art;
            if(data.MediaContainer.Video[i].Media !== undefined)
              for(var j=0;j<data.MediaContainer.Video[i].Media.length;j++){
                if(data.MediaContainer.Video[i].Media[j].$.optimizedForStreaming === undefined || data.MediaContainer.Video[i].Media[j].$.optimizedForStreaming == 0){
                  for(var k=0;k<data.MediaContainer.Video[i].Media[j].Part.length;k++){
                    if(config.savemeta){
                      if(!fs.existsSync(data.MediaContainer.Video[i].Media[j].Part[k].$.file + '.meta.xml') || config.overwriteExisting){
                        fs.writeFile(data.MediaContainer.Video[i].Media[j].Part[k].$.file + '.meta.xml', body, function(){
                          console.log("Saved metadata for " + videotitle);

                        });
                      }
                    }
                    savePoster(rootaddr + thumburl, data.MediaContainer.Video[i].Media[j].Part[k].$.file + '.thumb.jpg', videotitle);
                    saveArt(rootaddr + arturl, data.MediaContainer.Video[i].Media[j].Part[k].$.file + '.art.jpg', videotitle);
                  }
                }
            }
          }
      });
    }
  });
}
function processSeries(rootaddr, url){
  var mediaurl = rootaddr + url;

}

function savePoster(url, filepath, videotitle){
  if(config.savethumbs){
    if(!fs.existsSync(filepath) || config.overwriteExisting){
      request(url).pipe(fs.createWriteStream(filepath)).on('close', function(){
        console.log("Saved Thumbnail for " + videotitle);
      });
    }
  }
  if(config.savefolderposter){
    var posterpath = path.join(path.dirname(filepath), 'poster.jpg');
    if(!fs.existsSync(posterpath) || config.overwriteExisting){
      request(url).pipe(fs.createWriteStream(posterpath)).on('close', function(){
        console.log("Saved Poster for " + videotitle);
      });
    }
  }
  if(config.savefolderthumb){
    var folderpath = path.join(path.dirname(filepath), 'folder.jpg');
    if(!fs.existsSync(folderpath) || config.overwriteExisting){
      request(url).pipe(fs.createWriteStream(folderpath)).on('close', function(){
        console.log("Saved Folder thumbnail for " + videotitle);
      });
    }
  }

}
function saveArt(url, filepath, videotitle){
  request(url, function(error, response, body){
    if(config.saveart){
      if(!fs.existsSync(filepath) || config.overwriteExisting){
        request(url).pipe(fs.createWriteStream(filepath)).on('close', function(){
          console.log("Saved Artwork for " + videotitle);
        });
      }
    }
    if(config.savefolderart){
      var artpath = path.join(path.dirname(filepath), 'art.jpg');
      if(!fs.existsSync(artpath) || config.overwriteExisting){

        request(url).pipe(fs.createWriteStream(artpath)).on('close', function(){
          console.log("Saved Folder artwork for " + videotitle);
        });
      }
    }

  });
}


function logerr(err){
  if(err)
    console.log(err);
}
