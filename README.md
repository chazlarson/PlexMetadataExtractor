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

This fork adds plex token to allow connections, and writing out a Plex-Meta-Manager metadata.yml next to the movie file.  TV Series YML to come.
