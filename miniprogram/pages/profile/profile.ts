interface UserInfo {
  nickName: string;
  avatarUrl: string;
  gender: number;
  province: string;
  city: string;
  country: string;
}

interface UserInfoStorage {
  userInfo: UserInfo;
  code: string;
  loginTime: number;
}

Page({
  data: {
    userInfo: null as UserInfo | null,
    loginTime: ''
  },

  onLoad() {
    this.loadUserInfo();
  },

  onShow() {
    // 每次显示页面时重新加载用户信息，确保数据最新
    this.loadUserInfo();
  },

  // 加载用户信息
  loadUserInfo() {
    const userInfoStorage = wx.getStorageSync('userInfo') as UserInfoStorage | undefined;
    if (userInfoStorage && userInfoStorage.userInfo) {
      // 格式化登录时间
      const loginDate = new Date(userInfoStorage.loginTime);
      const formattedTime = `${loginDate.getFullYear()}-${String(loginDate.getMonth() + 1).padStart(2, '0')}-${String(loginDate.getDate()).padStart(2, '0')} ${String(loginDate.getHours()).padStart(2, '0')}:${String(loginDate.getMinutes()).padStart(2, '0')}`;
      
      this.setData({
        userInfo: userInfoStorage.userInfo,
        loginTime: formattedTime
      });
    } else {
      // 未登录，跳转到登录页
      wx.redirectTo({
        url: '/pages/login/login'
      });
    }
  },

  // 跳转到称重页面
  goToWeighing() {
    wx.navigateTo({
      url: '/pages/weighing/weighing'
    });
  },

  // 处理退出登录
  handleLogout() {
    wx.showModal({
      title: '提示',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          // 清除登录信息
          wx.removeStorageSync('userInfo');
          
          wx.showToast({
            title: '已退出登录',
            icon: 'success',
            duration: 1500
          });
          
          // 延迟跳转到登录页
          setTimeout(() => {
            wx.redirectTo({
              url: '/pages/login/login'
            });
          }, 1500);
        }
      }
    });
  }
}); 