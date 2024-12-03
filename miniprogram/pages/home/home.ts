Component({
  data: {},

  methods: {
    onWeighTap() {
      // 这里添加称重按钮点击后的逻辑
      wx.showToast({
        title: '开始称重',
        icon: 'success'
      })
    }
  }
}) 