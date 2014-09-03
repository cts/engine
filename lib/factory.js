var Model = require('cts/model');
var Util = require('cts/util');
var Adapters = {
  Html: require('cts/html-adapter'),
  GSheet: require('cts/gsheet-adapter')
};

module.exports = {
  Forrest: function(opts, factory) {
    // Returns Promise
    var forrest = new Model.Forrest(opts, factory);
    return forrest.initializeAsync();
  },

  Tree: function(spec, forrest) {
    if ((spec.url == null) && (spec.name == 'body')) {
      return Adapters.Html.Factory.TreeWithJquery(Util.$('body'), forrest, spec);
    } if ((spec.kind == "GSheet" || spec.kind == 'gsheet')) {
      return Adapters.GSheet.Factory.GSpreadsheetTree(spec, forrest);
    } else if (typeof spec.url == "string") {
      var promise = Util.Promise.defer();
      Util.Net.fetchString(spec).then(
        function(content) {
          if ((spec.kind == 'HTML') || (spec.kind == 'html')) {
            var div = Util.$("<div></div>");
            var nodes = Util.$.parseHTML(content);
            var jqNodes = Util._.map(nodes, function(n) {
              return Util.$(n);
            });
            div.append(jqNodes);
            if (spec.fixLinks) {
              Util.Helpers.rewriteRelativeLinks(div, spec.url);
            }
            Adapters.Html.Factory.TreeWithJquery(div, forrest, spec).then(
              function(tree) {
                promise.resolve(tree);
              },
              function(reason) {
                promise.reject(reason);
              }
            );
          } else {
            promise.reject("Don't know how to make Tree of kind: " + spec.kind);
          }
        },
        function(reason) {
          promise.reject(reason);
        }
      );
      return promise;
    } else {
      return Adapters.Html.Factory.TreeWithJquery(spec.url, forrest, spec);
    }
  }
};