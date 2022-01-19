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
