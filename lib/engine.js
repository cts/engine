var Util = require('cts/util');
var Factory = require('./factory');
var Model = require('cts/model');

/*
 * Available options:
 *
 * - autoLoadSpecs (default: true) - Should we autload specs from
 *   script and link elements
 * - forrestSpecs - optional array of forrest specs to load
 *
 */

var Engine = function(opts, args) {
  var defaults;
  this.opts = opts || {};
  this.bootStage = "PreBoot";

  if (typeof this.opts.autoLoadSpecs == 'undefined') {
    this.opts.autoLoadSpecs = true;
  }

  Model.Factory.registerAdapter(require('cts/html-adapter'));
  Model.Factory.registerAdapter(require('cts/gsheet-adapter'));

  // The main tree.
  this.forrest = null;
  this.initialize.apply(this, args);

  // TODO: Get rid of all these!
  this.status = {
    defaultTreeReady: Util.Promise.defer(),
    allRealized: Util.Promise.defer(),
    booted: Util.Promise.defer(),
    rendered: Util.Promise.defer()
  };

  // The forrest is loaded, but not yet rendered.    
  this.loaded = Util.Promise.defer();
  this.rendered = Util.Promise.defer();

};

// Instance Methods
// ----------------
Util._.extend(Engine.prototype, Util.Events, {

  initialize: function() {
  },

  on: function(evtName, callback) {
    this.forrest.on(evtName, callback);
  },

  /**
   * Rendering picks a primary tree. For each node in the tree, we:
   *  1: Process any *incoming* relations for its subtree.
   *  2: Process any *outgoing* tempalte operations
   *  3:
   */
  render: function(opts) {
    var self = this;
    var pt = this.forrest.getPrimaryTree();

    Util.Log.Debug("CTS::Engine::render called on Primary Tree");
    Util.Log.Tick("CTS:Engine Render");
    var options = Util._.extend({}, opts);
    pt.root._processIncoming(undefined, undefined, pt.root).then(
      function() {
        Util.Log.Debug("CTS::Engine::render finished on Primary Tree");
        Util.Log.Tock("CTS:Engine Render");
        self.status.rendered.resolve();
        self.rendered.resolve();
      },
      function(reason) {
        Util.Log.Error(reason);
        self.rendered.reject(reason);
        self.status.rendered.reject(reason);
      }
    ).done();
  },

  boot: function() {
    Util.Log.Info("Engine: Starting Boot");
    Util.Log.Tick("CTS:Boot");
    this.bootStage = "Booting";
    var self = this;
    if (typeof self.booting != 'undefined') {
      Util.Log.Error("Already booted / booting");
    } else {
      self.booting = true;
    }
    self.bootStage = "Loading Forrest";
    Util.Log.Tick("CTS:LoadForrest");
    self.loadForrest().then(function() {
      Util.Log.Debug("Engine: Loaded Forrest");
      self.bootStage = "Loading CTS";
      Util.Log.Tock("CTS:LoadForrest");
      Util.Log.Tick("CTS:LoadCTS");
      self.loaded.resolve();
      return self.loadCts();
    }).then(function() {
      Util.Log.Debug("Engine: Loaded CTS");
      Util.Log.Tock("CTS:LoadCTS");
      Util.Log.Tick("CTS:RealizeDependencies");
      self.bootStage = "Realizing Dependencies";
      return self.forrest.realizeDependencies();
    }).then(function() {
      Util.Log.Debug("Engine: Realized Dependencies");
      Util.Log.Tock("CTS:RealizeDependencies");
      Util.Log.Tick("CTS:RealizeTrees");
      self.bootStage = "Realize Trees";
      return self.forrest.realizeTrees();
    }).then(function() {
      Util.Log.Debug("Engine: Realized Trees");
      self.bootStage = "Realize Relations";
      Util.Log.Tock("CTS:RealizeTrees");
      Util.Log.Tick("CTS:RealizeRelations");
      return Util.Promise.fcall(function() {
        self.forrest.realizeRelations()
      });
    }).then(function() {
      self.status.allRealized.resolve();
      Util.Log.Tock("CTS:RealizeRelations");
      Util.Log.Info("Engine: CTS Realized Relations. Starting Render.");
      self.bootStage = "Render";
      self.render.call(self);
      self.bootStage = "Finalizing Boot";
      Util.Log.Tock("CTS:Boot");
      self.status.booted.resolve();
      return Util.Promise.fcall(function() { return true; });
    }).fail(function(error) {
      Util.Log.Error("Boot stage failed.", error);
      self.status.booted.reject(error);
      self.loaded.reject(error);
    }).done();
    return self.status.booted;
  },

  renderlessBoot: function() {
    Util.Log.Info("Engine: Starting Boot");
    Util.Log.Tick("CTS:Boot");
    this.bootStage = "Booting";
    var self = this;
    if (typeof self.booting != 'undefined') {
      Util.Log.Error("Already booted / booting");
    } else {
      self.booting = true;
    }
    self.bootStage = "Loading Forrest";
    Util.Log.Tick("CTS:LoadForrest");
    self.loadForrest().then(function() {
      self.bootStage = "Loading CTS";
      Util.Log.Tock("CTS:LoadForrest");
      Util.Log.Tick("CTS:LoadCTS");
      return self.loadCts();
    }).then(function() {
      self.status.defaultTreeReady.resolve();
      Util.Log.Debug("Engine: Loaded CTS");
      Util.Log.Tock("CTS:LoadCTS");
      Util.Log.Tick("CTS:RealizeDependencies");
      self.bootStage = "Realizing Dependencies";
      return self.forrest.realizeDependencies();
    }).then(function() {
      Util.Log.Debug("Engine: Realized Dependencies");
      Util.Log.Tock("CTS:RealizeDependencies");
      Util.Log.Tick("CTS:RealizeTrees");
      self.bootStage = "Realize Trees";
      return self.forrest.realizeTrees();
    }).then(function() {
      Util.Log.Debug("Engine: Realized Trees");
      self.bootStage = "Realize Relations";
      Util.Log.Tock("CTS:RealizeTrees");
      Util.Log.Tick("CTS:RealizeRelations");
      return Util.Promise.fcall(function() {
        self.forrest.realizeRelations()
      });
    }).then(function() {
      Util.Log.Tock("CTS:RealizeRelations");
      Util.Log.Tock("CTS:Boot");
      self.status.booted.resolve();
      return Util.Promise.fcall(function() { return true; });
    }).fail(function(error) {
      Util.Log.Error("Boot stage failed.", error);
      self.status.booted.reject(error);
    }).done();
    return self.status.booted;
  },

  loadForrest: function() {
    var promise = Util.Promise.defer();
    var self = this;
    if (typeof this.opts.forrest == 'undefined') {
      this.opts.forrest = {};
    }
    this.opts.forrest.engine = this;
    Model.Factory.Forrest(this.opts.forrest, Model.Factory).then(
      function(forrest) {
        self.forrest = forrest;
        Util.Log.Info("Engine: Resolved forrest.");
        promise.resolve();
      }
    );
    return promise;
  },

  addTree: function(kind, label, spec) {
    var treeSpec = Util._.extend({}, spec, {kind: kind, name: label});
    this.forrest.addTreeSpec(treeSpec);
    return this.forrest.realizeTree(treeSpec);
  },

  get: function(selector) {
    var parts = selector.split('|');
    var tree = 'body';
    if (parts.length > 0) {
      tree = parts[0].trim();
      selector = parts.slice(1).join('|');
    }
    if (typeof this.forrest.trees[tree] == 'undefined') {
      if (typeof this.forrest.treeSpecs[tree] == 'undefined') {
        Util.Log.Error("Unknown tree: ", tree);
        return null;
      } else {
        Util.Log.Error("Tree was not realized from selection spec: ", tree);
        return null;
      }
    }
    console.log("Trying to get", selector, "from", tree);
    var nodes = this.forrest.trees[tree].root.find(selector);
    console.log("Got", nodes.length, "nodes");
    var values = Util._.map(nodes, function(n) { return n.getValue(); });
    return values;
  },

  loadCts: function() {
    var promises = [];
    var self = this;

    // Possibly add specs from the OPTS hash passed to Engine.
    if ((typeof self.opts.forrestSpecs != 'undefined') && (self.opts.forrestSpecs.length > 0)) {
      promises.push(self.forrest.addSpecs(self.opts.forrestSpecs));
    }

    if ((typeof self.opts.autoLoadSpecs != 'undefined') && (self.opts.autoLoadSpecs === true)) {
      var links = Util.Helper.getTreesheetLinks();
      var ps = self.forrest.parseAndAddSpecsFromLinks(links);
      for (var i = 0; i < ps.length; i++) {
        promises.push(ps[i]);
      }
    }
    return Util.Promise.all(promises);
  },

  // Stops all event listeners
  shutdown: function() {
    this.forrest.stopListening();
  }

});

module.exports = Engine;

