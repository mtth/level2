/* jshint node: true */

/**
 * Frame decoding and extraction streams.
 *
 * These are meant to provide a single interface to all decoding and extracting
 * functions (also providing link type inference when possible).
 *
 */
(function (root) {
  'use strict';

  var stream = require('stream'),
      util = require('util'),
      extractors = require('./extractors');

  /**
   * Extractor stream class.
   *
   * Similarly to the decoder stream above, in order to be functional, this
   * duplex stream must be activated first (see method below). The first time
   * `_read` or `_write` is called, the extractor will look up the appropriate
   * extracting function based on the link type and override both methods.
   *
   */
  function Extractor(opts) {

    opts = opts || {};
    var fromLinkType = opts.fromLinkType;
    var toLinkType = opts.toLinkType;

    stream.Duplex.call(this, {objectMode: true});

    this.getLinkType = function (incoming) {

      return incoming ? fromLinkType : toLinkType;

    };

    this.on('pipe', function (src) {

      if (!fromLinkType) {
        fromLinkType = src.getLinkType();
      } else if (fromLinkType !== src.getLinkType()) {
        return this.emit('error', new Error('Inconsistent source link type.'));
      }

      if (!toLinkType) {
        if (fromLinkType in extractors) {
          var toLinkTypes = Object.keys(extractors[fromLinkType]);
          if (toLinkTypes.length === 1) {
            toLinkType = toLinkTypes[0];
          } else {
            return this.emit('error', new Error('Ambiguous target link type.'));
          }
        } else {
          return this.emit(
            'error', new Error('No valid target link type from ' + fromLinkType)
          );
        }
      }

    });

    this.once('finish', function () { this.push(null); });
    // Emit 'end' event when writable sides finishes (duplex streams don't seem
    // to do so, unlike transform streams).

    this._read = function () {

      activate();
      this._read();

    };

    this._write = function (data, encoding, callback) {

      activate();
      this._write(data, encoding, callback);

    };

    var self = this;

    function activate() {

      if (fromLinkType && toLinkType) {
        var srcExtractors = extractors[fromLinkType];
        if (srcExtractors && toLinkType in srcExtractors) {
          srcExtractors[toLinkType].call(self, opts);
        } else {
          self.emit(
            'error', new Error(
              'Unsupported link types: ' + fromLinkType + ' -> ' + toLinkType
            )
          );
        }
      } else {
        self.emit('error', new Error('Missing link types.'));
      }

    }

  }
  util.inherits(Extractor, stream.Duplex);

  // Export things.

  root.exports = {
    Extractor: Extractor
  };

})(module);
