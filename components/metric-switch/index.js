Component({
  options: {
    styleIsolation: 'shared',
    addGlobalClass: true
  },

  properties: {
    currentType: {
      type: String,
      value: 'Gsr'
    },
    showThermal: {
      type: Boolean,
      value: false
    }
  },

  methods: {
    onChangeType(e) {
      this.triggerEvent('changetype', {
        type: e.currentTarget.dataset.type
      });
    },

    onToggleThermal() {
      this.triggerEvent('togglethermal');
    }
  }
});
