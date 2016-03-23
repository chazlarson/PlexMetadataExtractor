// !minifyOnSave

'use strict';

var async = require('async');
var fs = require('fs');
var path = require('path');
var request = require('request');
var parseString = require('xml2js').parseString;
var chalk = require('chalk');

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
  }
];

var libraryquestions = [
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
]

var movielibraryquestions = [
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
var libraries = {};

// load the configuration
var configstring = '';
if(fs.existsSync('config.json'))
  configstring = fs.readFileSync('config.json');

if(configstring != ''){
  config = JSON.parse(configstring);
}else{
  console.log(chalk.bgYellow.black(" WARN ") + chalk.bold(' No configuration settings found!'));
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
    if(err)
      console.log(chalk.brRed.white(" ERR  ") + " " + err);

    console.log(chalk.bgBlue(" INFO ") + chalk.bold(" Configuration saved!"));
  });
}

function saveLibraryConfig(libraryjson){
  fs.writeFile('libraries.json', JSON.stringify(libraryjson), function(err){
    if(err)
      console.log(chalk.brRed.white(" ERR  ") + " " + err);

    console.log(chalk.bgBlue(" INFO ") + chalk.bold(" Library configuration saved!"));
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
  console.log(chalk.bgBlue(" INFO ") + chalk.bold(" Entering configuration mode for PlexMetadataExtractor"))
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

        console.log(chalk.bgBlue(" INFO ") + chalk.bold(' Discovering Libraries'));

        request(rootaddr + '/library/sections',
          function(error, response, body){

            if(!error && response.statusCode == 200){
              parseString(body, function(err,data){
                var libraryconfigupdated = false;
                var libs = []
                for(var i=0;i<data.MediaContainer.Directory.length;i++){
                  //console.log('Discovered ' + data.MediaContainer.Directory[i].$.title + '...');
                  libs.push({key: data.MediaContainer.Directory[i].$.key, title: data.MediaContainer.Directory[i].$.title, type: data.MediaContainer.Directory[i].$.type});
                }
                async.eachSeries(libs, function(lib, itemcallback){
                  if(!libraries[lib.key]){
                    libraryconfigupdated = true;
                    console.log(chalk.bgBlue.white(" INFO ") + chalk.bold(" New libray discovered \"" + lib.title + "\""))
                    var thislibquestions = libraryquestions.slice();
                    if(lib.type == "movie") thislibquestions = thislibquestions.concat(movielibraryquestions);

                    inquirer.prompt(thislibquestions, function(answers){
                      libraries[lib.key] = answers;
                      itemcallback();
                    });
                  }else{
                    itemcallback();
                  }

                }, function(err){
                  if(err){
                    console.log(err);
                  }
                  if(libraryconfigupdated){
                    inquirer.prompt([{type: "confirm", name: "saveLibraryConfig", message: "Save library configuration?", default: true}],
                    function(answers){
                      if(answers.saveLibraryConfig){
                        saveLibraryConfig(libraries);
                      }
                      async.each(libs, function(lib){

                          if(libraries[lib.key].processLibrary){
                            processLibrary(rootaddr, lib.key, lib.type, lib.title);
                          }
                      });
                    });
                  }else{
                    async.each(libs, function(lib){

                        if(libraries[lib.key].processLibrary){
                          processLibrary(rootaddr, lib.key, lib.type, lib.title);
                        }
                    });
                  }
                });

              });
            }else{
              console.log(chalk.bgRed.black(" ERR  ") + chalk.bold('Failed to discover libraries, arborted!'));
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
                    if(libraries[data.MediaContainer.$.librarySectionID].savemeta){
                      if(!fs.existsSync(data.MediaContainer.Video[i].Media[j].Part[k].$.file + '.meta.xml') || libraries[data.MediaContainer.$.librarySectionID].overwriteExisting){
                        fs.writeFile(data.MediaContainer.Video[i].Media[j].Part[k].$.file + '.meta.xml', body, function(){
                          console.log("Saved metadata for " + videotitle);

                        });
                      }
                    }
                    if(libraries[data.MediaContainer.$.librarySectionID].savethumbs){
                      if(!fs.existsSync(data.MediaContainer.Video[i].Media[j].Part[k].$.file + '.thumb.jpg') || libraries[data.MediaContainer.$.librarySectionID].overwriteExisting){
                        savePoster(rootaddr + thumburl, data.MediaContainer.Video[i].Media[j].Part[k].$.file + '.thumb.jpg', videotitle);
                      }
                    }
                    if(libraries[data.MediaContainer.$.librarySectionID].saveart){
                      if(!fs.existsSync(data.MediaContainer.Video[i].Media[j].Part[k].$.file + '.art.jpg') || libraries[data.MediaContainer.$.librarySectionID].overwriteExisting){
                        saveArt(rootaddr + arturl, data.MediaContainer.Video[i].Media[j].Part[k].$.file + '.art.jpg', videotitle);
                      }
                    }
                    if(libraries[data.MediaContainer.$.librarySectionID].savefolderposter){
                      if(!fs.existsSync('poster.jpg') || libraries[data.MediaContainer.$.librarySectionID].overwriteExisting){
                        savePoster(rootaddr + thumburl, path.join(path.dirname(data.MediaContainer.Video[i].Media[j].Part[k].$.file), 'poster.jpg'), videotitle);
                      }
                    }
                    if(libraries[data.MediaContainer.$.librarySectionID].savefolderthumb){
                      if(!fs.existsSync('folder.jpg') || libraries[data.MediaContainer.$.librarySectionID].overwriteExisting){
                        savePoster(rootaddr + thumburl, path.join(path.dirname(data.MediaContainer.Video[i].Media[j].Part[k].$.file), 'folder.jpg'), videotitle);
                      }
                    }
                    if(libraries[data.MediaContainer.$.librarySectionID].savefolderart){
                      if(!fs.existsSync('art.jpg') || libraries[data.MediaContainer.$.librarySectionID].overwriteExisting){
                        saveArt(rootaddr + arturl, path.join(path.dirname(data.MediaContainer.Video[i].Media[j].Part[k].$.file), 'art.jpg'), videotitle);
                      }
                    }

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
    request(url).pipe(fs.createWriteStream(filepath)).on('close', function(){
      console.log("Saved Thumbnail for " + videotitle);
    });
}


function saveArt(url, filepath, videotitle){
  request(url).pipe(fs.createWriteStream(filepath)).on('close', function(){
    console.log("Saved Artwork for " + videotitle);
  });
}



function logerr(err){
  if(err)
    console.log(err);
}
