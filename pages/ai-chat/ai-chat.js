function isIntermediateAgentMessage(text) {
  return /\[Round\s+\d+\]\s*Snap:/i.test(String(text || ''));
}

Page({
  data: {
    messages: [],
    inputValue: '',
    loading: false,
    deviceOnline: false,
    lastTs: 0,
    pollTimer: null,
    quickPrompts: [
      { label: '健康建议', prompt: '请查询 OBS 桶内最新的数据，并简洁告诉我。' },
      { label: '设备状态', prompt: '请简要汇报当前设备的运行和传感器状态。' }
    ]
  },

  onLoad() {
    // Local greeting only: do not call the cloud function or MQTT.
    this.setData({
      messages: [{
        role: 'assistant',
        text: '你好，我是健康监测助手。我可以帮你查询 OBS 历史数据、了解设备状态，并根据监测结果提供简要分析。',
        ts: Date.now()
      }]
    });
    this.startPolling();
  },

  onUnload() {
    if (this.data.pollTimer) {
      clearInterval(this.data.pollTimer);
    }
  },

  startPolling() {
    this.pollMessages();
    const timer = setInterval(() => {
      this.pollMessages();
    }, 4000);
    this.setData({ pollTimer: timer });
  },

  async pollMessages() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'mqtt-proxy',
        data: {
          action: 'poll',
          lastTs: this.data.lastTs
        }
      });

      if (res.result && res.result.success) {
        // A poll without a fresh status must not retain a previous "online"
        // value indefinitely.
        const updates = { deviceOnline: res.result.online === true };

        if (res.result.messages && res.result.messages.length > 0) {
          const newMsgs = res.result.messages
            .filter(msg => !isIntermediateAgentMessage(msg.text))
            .map(msg => ({
              role: 'assistant',
              text: msg.text || '',
              ts: msg.ts || Date.now()
            }));

          updates.lastTs = res.result.latestTs;
          if (newMsgs.length > 0) {
            updates.messages = this.data.messages.concat(newMsgs);
          }
          updates.loading = false;
        }

        if (Object.keys(updates).length > 0) {
          this.setData(updates);
          if (updates.messages) this.scrollToBottom();
        }
      }
    } catch (err) {
      console.error('Poll error:', err);
      // The cloud function or MQTT broker is unreachable, so the device
      // cannot be confirmed online.
      this.setData({ deviceOnline: false });
    }
  },

  async sendMessage(quickPrompt = '') {
    // Direct bindtap calls pass a tap event; only quick-action buttons pass
    // a prompt string. Fall back to the typed input for event arguments.
    const source = typeof quickPrompt === 'string' ? quickPrompt : this.data.inputValue;
    const text = source.trim();
    if (!text || this.data.loading) return;

    const userMsg = {
      role: 'user',
      text: text,
      ts: Date.now()
    };

    this.setData({
      messages: this.data.messages.concat([userMsg]),
      inputValue: '',
      loading: true
    });

    this.scrollToBottom();

    try {
      const res = await wx.cloud.callFunction({
        name: 'mqtt-proxy',
        data: {
          action: 'send',
          text: text
        }
      });

      if (!res.result || !res.result.success) {
        wx.showToast({ title: '发送失败', icon: 'error' });
        this.setData({ loading: false });
      }
    } catch (err) {
      console.error('Send error:', err);
      wx.showToast({ title: '发送出错', icon: 'error' });
      this.setData({ loading: false });
    }
  },

  scrollToBottom() {
    setTimeout(() => {
      wx.pageScrollTo({
        scrollTop: 99999,
        duration: 200
      });
    }, 100);
  },

  onInput(e) {
    this.setData({ inputValue: e.detail.value });
  },

  onConfirm() {
    this.sendMessage();
  },

  onQuickPrompt(e) {
    const prompt = e.currentTarget.dataset.prompt;
    if (prompt) this.sendMessage(prompt);
  }
});
