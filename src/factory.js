CTS.Factory = {
  Forrest: function(opts) {
    // Returns Promise
    var forrest = new CTS.Forrest(opts);
    return forrest.initializeAsync();
  },

  Tree: function(spec, forrest) {
    if ((spec.url == null) && (spec.name == 'body')) {
      return CTS.Adapters.Html.Factory.TreeWithJquery(CTS.$('body'), forrest, spec);
    } if ((spec.kind == "GSheet" || spec.kind == 'gsheet')) {
      return CTS.Adapters.GSheet.Factory.GSpreadsheetTree(spec, forrest);
    } else if (typeof spec.url == "string") {
      var promise = CTS.Promise.defer();
      CTS.Util.fetchString(spec).then(
        function(content) {
          if ((spec.kind == 'HTML') || (spec.kind == 'html')) {
            var div = CTS.$("<div></div>");
            var nodes = CTS.$.parseHTML(content);
            var jqNodes = Fn.map(nodes, function(n) {
              return CTS.$(n);
            });
            div.append(jqNodes);
            if (spec.fixLinks) {
              CTS.Util.rewriteRelativeLinks(div, spec.url);
            }
            CTS.Adapters.Html.Factory.TreeWithJquery(div, forrest, spec).then(
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
      return CTS.Factory.TreeWithJquery(spec.url, forrest, spec);
    }
  }
};