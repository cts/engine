// Engine
// ==========================================================================

/*
 * Available options:
 *
 * - autoLoadSpecs (default: true) - Should we autload specs from
 *   script and link elements
 * - forrestSpecs - optional array of forrest specs to load
 *
 */

var Engine = CTS.Engine = function(opts, args) {
  var defaults;
  this.opts = opts || {};
  this.bootStage = "PreBoot";

  if (typeof this.opts.autoLoadSpecs == 'undefined') {
    this.opts.autoLoadSpecs = true;
  }

  // The main tree.
  this.forrest = null;
  this.initialize.apply(this, args);

  this.status = {
    defaultTreeReady: CTS.Promise.defer(),
    allRealized: CTS.Promise.defer(),
    booted: CTS.Promise.defer(),
    rendered: CTS.Promise.defer()
  };
};

// Instance Methods
// ----------------
CTS.Fn.extend(Engine.prototype, Events, {

  initialize: function() {
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

    CTS.Log.Debug("CTS::Engine::render called on Primary Tree");
    CTS.Log.Tick("CTS:Engine Render");
    var options = CTS.Fn.extend({}, opts);
    pt.root._processIncoming().then(
      function() {
        CTS.Log.Debug("CTS::Engine::render finished on Primary Tree");
        CTS.Log.Tock("CTS:Engine Render");
        self.status.rendered.resolve();
      },
      function(reason) {
        CTS.Log.Error(reason);
        self.status.rendered.reject(reason);
      }
    ).done();
  },

  boot: function() {
    CTS.Log.Info("Engine: Starting Boot");
    CTS.Log.Tick("CTS:Boot");
    this.bootStage = "Booting";
    var self = this;
    if (typeof self.booting != 'undefined') {
      CTS.Error("Already booted / booting");
    } else {
      self.booting = true;
    }
    self.bootStage = "Loading Forrest";
    CTS.Log.Tick("CTS:LoadForrest");
    self.loadForrest().then(function() {
      CTS.Log.Debug("Engine: Loaded Forrest");
      self.bootStage = "Loading CTS";
      CTS.Log.Tock("CTS:LoadForrest");
      CTS.Log.Tick("CTS:LoadCTS");
      return self.loadCts();
    }).then(function() {
      CTS.Log.Debug("Engine: Loaded CTS");
      CTS.Log.Tock("CTS:LoadCTS");
      CTS.Log.Tick("CTS:RealizeDependencies");
      self.bootStage = "Realizing Dependencies";
      return self.forrest.realizeDependencies();
    }).then(function() {
      CTS.Log.Debug("Engine: Realized Dependencies");
      CTS.Log.Tock("CTS:RealizeDependencies");
      CTS.Log.Tick("CTS:RealizeTrees");
      self.bootStage = "Realize Trees";
      return self.forrest.realizeTrees();
    }).then(function() {
      CTS.Log.Debug("Engine: Realized Trees");
      self.bootStage = "Realize Relations";
      CTS.Log.Tock("CTS:RealizeTrees");
      CTS.Log.Tick("CTS:RealizeRelations");
      return CTS.Promise.fcall(function() {
        self.forrest.realizeRelations()
      });
    }).then(function() {
      self.status.allRealized.resolve();
      CTS.Log.Tock("CTS:RealizeRelations");
      CTS.Log.Info("Engine: CTS Realized Relations. Starting Render.");
      self.bootStage = "Render";
      self.render.call(self);
      self.bootStage = "Finalizing Boot";
      CTS.Log.Tock("CTS:Boot");
      self.status.booted.resolve();
      return CTS.Promise.fcall(function() { return true; });
    }).fail(function(error) {
      CTS.Log.Error("Boot stage failed.", error);
      self.status.booted.reject(error);
    }).done();
    return self.status.booted;
  },

  renderlessBoot: function() {
    CTS.Log.Info("Engine: Starting Boot");
    CTS.Log.Tick("CTS:Boot");
    this.bootStage = "Booting";
    var self = this;
    if (typeof self.booting != 'undefined') {
      CTS.Error("Already booted / booting");
    } else {
      self.booting = true;
    }
    self.bootStage = "Loading Forrest";
    CTS.Log.Tick("CTS:LoadForrest");
    self.loadForrest().then(function() {
      self.bootStage = "Loading CTS";
      CTS.Log.Tock("CTS:LoadForrest");
      CTS.Log.Tick("CTS:LoadCTS");
      return self.loadCts();
    }).then(function() {
      self.status.defaultTreeReady.resolve();
      CTS.Log.Debug("Engine: Loaded CTS");
      CTS.Log.Tock("CTS:LoadCTS");
      CTS.Log.Tick("CTS:RealizeDependencies");
      self.bootStage = "Realizing Dependencies";
      return self.forrest.realizeDependencies();
    }).then(function() {
      CTS.Log.Debug("Engine: Realized Dependencies");
      CTS.Log.Tock("CTS:RealizeDependencies");
      CTS.Log.Tick("CTS:RealizeTrees");
      self.bootStage = "Realize Trees";
      return self.forrest.realizeTrees();
    }).then(function() {
      CTS.Log.Debug("Engine: Realized Trees");
      self.bootStage = "Realize Relations";
      CTS.Log.Tock("CTS:RealizeTrees");
      CTS.Log.Tick("CTS:RealizeRelations");
      return CTS.Promise.fcall(function() {
        self.forrest.realizeRelations()
      });
    }).then(function() {
      CTS.Log.Tock("CTS:RealizeRelations");
      CTS.Log.Tock("CTS:Boot");
      self.status.booted.resolve();
      return CTS.Promise.fcall(function() { return true; });
    }).fail(function(error) {
      CTS.Log.Error("Boot stage failed.", error);
      self.status.booted.reject(error);
    }).done();
    return self.status.booted;
  },

  loadForrest: function() {
    var promise = CTS.Promise.defer();
    var self = this;
    if (typeof this.opts.forrest == 'undefined') {
      this.opts.forrest = {};
    }
    this.opts.forrest.engine = this;
    CTS.Factory.Forrest(this.opts.forrest).then(
      function(forrest) {
        self.forrest = forrest;
        CTS.Log.Info("Engine: Resolved forrest.");
        promise.resolve();
      }
    );
    return promise;
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
        CTS.Log.Error("Unknown tree: ", tree);
        return null;
      } else {
        CTS.Log.Error("Tree was not realized from selection spec: ", tree);
        return null;
      }
    }
    console.log("Trying to get", selector, "from", tree);
    var nodes = this.forrest.trees[tree].root.find(selector);
    console.log("Got", nodes.length, "nodes");
    var values = CTS.Fn.map(nodes, function(n) { return n.getValue(); });
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
      var links = CTS.Util.getTreesheetLinks();
      var ps = self.forrest.parseAndAddSpecsFromLinks(links);
      for (var i = 0; i < ps.length; i++) {
        promises.push(ps[i]);
      }
    }
    return CTS.Promise.all(promises);
  },

  // Stops all event listeners
  shutdown: function() {
    this.forrest.stopListening();
  }

});
