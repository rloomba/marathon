define([
  "Backbone",
  "Underscore",
  "models/TaskCollection"
], function(Backbone, _, TaskCollection) {
  function ValidationError(attribute, message) {
    this.attribute = attribute;
    this.message = message;
  }

  // Attributes that are returned from the API but are not configurable by
  // the user. These are omitted from the stringified version of the App.
  var READ_ONLY_ATTRIBUTES = ["tasksRunning", "tasksStaged"];

  return Backbone.Model.extend({
    defaults: function() {
      return {
        // Required attributes
        cpus: 0.1,
        id: _.uniqueId("app_"),
        instances: 1,
        mem: 16.0,

        // Optional attributes
        cmd: null,
        constraints: [],
        container: null,
        env: {},
        executor: "",
        ports: [0],
        uris: []
      };
    },
    initialize: function(options) {
      // If this model belongs to a collection when it is instantiated, it has
      // already been persisted to the server.
      this.persisted = (this.collection != null);

      this.tasks = new TaskCollection(null, {appId: this.id});
      this.on({
        "change:id": function(model, value, options) {
          // Inform TaskCollection of new ID so it can send requests to the new
          // endpoint.
          this.tasks.options.appId = value;
        },
        "sync": function(model, response, options) {
          this.persisted = true;
        }
      });
    },
    isNew: function() {
      return !this.persisted;
    },
    stringify: function(space) {
      return JSON.stringify(
        this.attributes,
        function(k, v) {
          // Omit read-only attributes so the resulting string can be copied and
          // pasted as a command line argument.
          if (k === "" || READ_ONLY_ATTRIBUTES.indexOf(k) < 0) return v;
        },
        space);
    },
    validate: function(attrs, options) {
      var errors = [];

      if (_.isNaN(attrs.mem) || !_.isNumber(attrs.mem) || attrs.mem < 0) {
        errors.push(
          new ValidationError("mem", "Memory must be a non-negative Number"));
      }

      if (_.isNaN(attrs.cpus) || !_.isNumber(attrs.cpus) || attrs.cpus < 0) {
        errors.push(
          new ValidationError("cpus", "CPUs must be a non-negative Number"));
      }

      if (_.isNaN(attrs.instances) || !_.isNumber(attrs.instances) ||
          attrs.instances < 0) {
        errors.push(
          new ValidationError("instances", "Instances must be a non-negative Number"));
      }

      if (!_.isString(attrs.id) || attrs.id.length < 1) {
        errors.push(
          new ValidationError("id", "ID must be a non-empty String"));
      }

      if (!_.isString(attrs.cmd) || attrs.cmd.length < 1) {
        // Prevent erroring out on UPDATE operations like scale/suspend. 
        // If cmd string is empty, then don't error out if an executor and
        // container are provided.
        if (!_.isString(attrs.executor) || attrs.executor.length < 1 ||
            attrs.container == null || !_.isString(attrs.container.image) ||
            attrs.container.image.length < 1 ||
            attrs.container.image.indexOf('docker') != 0) {
          errors.push(
            new ValidationError("cmd",
              "Command must be a non-empty String if executor and container image are not provided"
            )
          );
        }
      }

      if (errors.length > 0) return errors;
    }
  });
});
