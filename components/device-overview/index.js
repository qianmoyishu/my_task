Component({
  options: {
    styleIsolation: 'shared',
    addGlobalClass: true
  },

  properties: {
    deviceKeyInput: {
      type: String,
      value: ''
    },
    deviceName: {
      type: String,
      value: ''
    },
    deviceStatus: {
      type: String,
      value: '离线'
    },
    lastUpdatedTime: {
      type: String,
      value: '--'
    },
    isLoading: {
      type: Boolean,
      value: false
    },
    error: {
      type: String,
      value: ''
    }
  },

  methods: {
    onInput(e) {
      this.triggerEvent('devicekeyinput', {
        value: e.detail.value
      });
    },

    onSubmit() {
      this.triggerEvent('submitkey');
    },

    onRefresh() {
      this.triggerEvent('refresh');
    }
  }
});
