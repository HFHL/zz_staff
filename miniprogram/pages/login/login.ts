interface PageData {
  username: string;
  password: string;
}

Page<PageData>({
  data: {
    username: '',
    password: ''
  },

  onLoad() {
    // 检查是否已登录
    const userInfo = wx.getStorageSync('userInfo');
    if (userInfo) {
      wx.redirectTo({
        url: '/pages/home/home'
      });
    }
  },

  handleLogin() {
    const { username, password } = this.data;
    
    if (!username || !password) {
      wx.showToast({
        title: '请输入账号和密码',
        icon: 'none'
      });
      return;
    }

    // 这里是测试账号，实际应该连接后端验证
    if (username === 'admin' && password === '123') {
      // 保存登录状态
      wx.setStorageSync('userInfo', {
        username,
        loginTime: new Date().getTime()
      });

      wx.showToast({
        title: '登录成功',
        icon: 'success',
        duration: 1500
      });

      // 延迟跳转，让用户看到成功提示
      setTimeout(() => {
        wx.reLaunch({
          url: '/pages/home/home'
        });
      }, 1500);
    } else {
      wx.showToast({
        title: '账号或密码错误',
        icon: 'none'
      });
    }
  },

  onUsernameInput(e: WechatMiniprogram.Input) {
    this.setData({
      username: e.detail.value
    });
  },

  onPasswordInput(e: WechatMiniprogram.Input) {
    this.setData({
      password: e.detail.value
    });
  }
});
