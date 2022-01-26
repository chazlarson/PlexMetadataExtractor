# PlexMetadataExtractor
Extract Metadata from Plex Media Server and store it alongside your files.

This NodeJS script was originally designed to extract image metadata from Plex Media Server with the purpose of providing folder.jpg files to generate folder thumbnails on the Microsoft Windows Operating System.

The use case has subsequently been expanded to extract all appropriate metadata, including images.

The idea is to allow extraction of everything, so please let me know if I've missed something, but allow configuration of exactly what should be saved.

For now configuration must be saved, but command line arguments should be coming soon.

Currently supports discovery of:
 - Movie libraries
 - TV Show libraries

No additional processing of xml is performed prior to it being saved.

It is intended that this script be run on the PMS host, though sufficient configuration is provided to allow remote processing, you may run into problems where the PART path described by PMS is not accessible from the execution location.

## This fork

This fork adds plex token to allow connections, and writing out a Plex-Meta-Manager metadata.yml.  TV Series YML to come.

Config:

```
{
  "address": "IP OR FQDN",
  "port": "###",
  "protocol": "https",
  "token": "YOUR_PLEX_TOKEN",
  "metadataPath": "./metadata",      << Save the metadata here
  "mediaBasePath": "/mnt/unionfs/"   << base path of your media
}
```

The original script wrote all the metadata out to the same directory as the media files.  My media is on a readonly filesystem, so I added the `metadataPath` and `mediaBasePath`.  The script will sub the first for the second in the mediapath, so all the files that would normally get written to the media dir will go into a mirror filesystem rooted at `metadataPath`.

Running this on my own huge libraries has shown that there are some conditions where the script can't connect to Plex and it aborts.  I don't think this is due to any of my changes, but I can't verify that due to the aforementioned read-only file system.

## Usage

1. Install node
1. `git clone https://github.com/chazlarson/PlexMetadataExtractor`
1. `cd PlexMetadataExtractor`
1. `npm install`
1. `cp config.json.example config.json`
1. Edit config.json to suit
1. `node index.js`


You'll be asked a bunch of questions about all your libraries, after which it will start reading them:
```
$ node index.js
 INFO  https://bing.bang.boing:443
 INFO  Discovering Libraries
 INFO  New library discovered "Movies - 4K"
? Do you want to process this library? No
 INFO  New library discovered "Movies - 4K DV"
? Do you want to process this library? Yes
? Overwrite existing files? Yes
? Save metadata alongside each media file? Yes
? Save thumbnail alongside each media file? Yes
? Save artwork alongside each media file? Yes
? Are all movies in their own folder? Yes
? Save poster.jpg from thumbnail into containing folder? Yes
? Save folder.jpg from thumbnail into containing folder? Yes
? Save art.jpg from artwork into containing folder? Yes

...SNIP...

? Save library configuration? Yes
 INFO  Library configuration saved!
 INFO  Discovered 631 items
 INFO  Saving metadata [====                ] 19% 1435.7s
```

If you answered "Yes" to that last question, the libraries and your answers will be stored in `libraries.json` and you won't be asked those questions again on next run.

The script will save something like this for each movie [depending on your answers above]:
```
$ tree metadata/movies/4k-dv/A\ Bugs\ Life\ \(1998\)\ \{tmdb-9487\}
metadata/movies/4k-dv/A\ Bugs\ Life\ (1998)\ {tmdb-9487}
├── A.Bugs.Life.1998.2160p.WEB-DL.TrueHD.Atmos.7.1.DV.HEVC-NOSiViD.mkv.art.jpg
├── A.Bugs.Life.1998.2160p.WEB-DL.TrueHD.Atmos.7.1.DV.HEVC-NOSiViD.mkv.thumb.jpg
├── art.jpg
├── folder.jpg
├── pmm-metadata.yml
└── poster.jpg
```
