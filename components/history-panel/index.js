Component({
  options: {
    styleIsolation: 'shared',
    addGlobalClass: true
  },

  properties: {
    availableDates: {
      type: Array,
      value: []
    },
    datesLoading: {
      type: Boolean,
      value: false
    },
    selectedDateKeys: {
      type: Array,
      value: []
    },
    obsHistory: {
      type: Array,
      value: []
    },
    obsLoading: {
      type: Boolean,
      value: false
    },
    showHistory: {
      type: Boolean,
      value: false
    },
    pagedHistory: {
      type: Array,
      value: []
    },
    historyPage: {
      type: Number,
      value: 1
    },
    currentData: {
      type: Object,
      value: {
        unit: ''
      }
    }
  },

  methods: {
    onClearDates() {
      this.triggerEvent('cleardates');
    },

    onLoadDates() {
      this.triggerEvent('loaddates');
    },

    onToggleDate(e) {
      this.triggerEvent('toggledate', {
        key: e.currentTarget.dataset.key
      });
    },

    onToggleHistory() {
      this.triggerEvent('togglehistory');
    },

    onRefreshHistory() {
      this.triggerEvent('refreshhistory');
    },

    onPrevPage() {
      this.triggerEvent('prevpage');
    },

    onNextPage() {
      this.triggerEvent('nextpage');
    }
  }
});
