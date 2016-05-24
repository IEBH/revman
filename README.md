Simple RevMan XML file reader
=============================
Simple module that reads a RevMan XML file and makes it suitable for use in Node.

The following operations are applied to the raw source data:

* XML (buffer or string) translated into JSON object
* All XML keys lower-cased and camelCased
* Initial `cochraneReview` key removed and main body returned as object
* Date fields automatically translated into Date objects
* Various fields automatically translated into arrays
* The `participants` field will automatically be calculated for each comparison and each individual `dichOutcome`


```javascript
var revman = require('revman');

revman.parseFile('./test/data/antibiotics-for-sore-throat.rm5', function(err, res) {
	// Data should now be a JSON tree object
});
```

See the [antibiotics-for-sore-throat.json](test/data/antibiotics-for-sore-throat.json) file for the JSON output for that sample file and as a rough guide as to the valid Revman fields.


Sample data credits
===================
Thanks to Anneliese Spinks, Paul Glasziou, Chris Del Mar for the sample data set [antibiotics-for-sore-throat](test/data/antibiotics-for-sore-throat.rm5) which forms the supplied testing kit.
