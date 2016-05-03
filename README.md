Simple RevMan XML file reader
=============================
Simple module that reads a RevMan XML file and makes it suitable for use in Node.

The following operations are applied to the raw source data:

* XML (buffer or string) translated into JSON object
* All XML keys lowercaseed and camelCased
* Initial `cochraneReview` key removed and main body returned as object
* Date fields automatically translated into Date objects
* Various fields automatically translated into arrays
