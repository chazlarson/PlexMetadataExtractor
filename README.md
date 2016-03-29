# PlexMetadataExtractor
Extract Metadata from Plex Media Server and store it alongside your files.

This NodeJS script was originally designed to extract image metadata from Plex Media Server with the purpose of providing folder.jpg files to generate folder thumbnails on the Microsoft Windows Operating System.

The use case has subsequently been expanded to extract all appropriate metadata, including images.

Currently supports discovery of:
 - Movie libraries
 - TV Show libraries


No additional processing of xml is performed prior to it being saved.

It is intended that this script be run on the PMS host, though sufficient configuration is provided to allow remote processing, you may run into problems where the PART path described by PMS is not accessible from the execution location.
