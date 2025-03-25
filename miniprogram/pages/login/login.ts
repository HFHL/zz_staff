interface UserInfo {
  nickName: string;
  avatarUrl: string;
  gender: number;
  province: string;
  city: string;
  country: string;
}

Page({
  data: {
    userInfo: {} as UserInfo,
    hasUserInfo: false,
    canIUseGetUserProfile: false
  },

  onLoad() {
    // 检查是否已登录
    const userInfo = wx.getStorageSync('userInfo');
    if (userInfo) {
      // 已登录，跳转到个人页面
      wx.redirectTo({
        url: '/pages/profile/profile'
      });
      return;
    }
    
    // 检查是否支持 getUserProfile
    if (typeof wx.getUserProfile === 'function') {
      this.setData({
        canIUseGetUserProfile: true
      });
    }
  },
  
  // 使用 getUserProfile 获取用户信息（推荐）
  getUserProfile() {
    // 推荐使用wx.getUserProfile获取用户信息，开发者每次通过该接口获取用户个人信息均需用户确认
    wx.getUserProfile({
      desc: '用于完善会员资料', // 声明获取用户个人信息后的用途，后续会展示在弹窗中
      success: (res) => {
        this.setData({
          userInfo: res.userInfo,
          hasUserInfo: true
        });
        
        // 获取登录凭证
        this.saveUserInfoAndLogin(res.userInfo);
      }
    });
  },
  
  // 使用 getUserInfo 获取用户信息（不推荐）
  getUserInfo(e: any) {
    // 不推荐使用getUserInfo获取用户信息，预计自2021年4月13日起，getUserInfo将不再弹出弹窗，并直接返回匿名的用户个人信息
    if (e.detail.userInfo) {
      this.setData({
        userInfo: e.detail.userInfo,
        hasUserInfo: true
      });
      
      // 获取登录凭证
      this.saveUserInfoAndLogin(e.detail.userInfo);
    }
  },
  
  // 保存用户信息并登录
  saveUserInfoAndLogin(userInfo: UserInfo) {
    wx.login({
      success: (loginRes) => {
        if (loginRes.code) {
          // 保存用户信息和登录状态
          const loginInfo = {
            userInfo: userInfo,
            code: loginRes.code,
            loginTime: new Date().getTime()
          };
          
          wx.setStorageSync('userInfo', loginInfo);
          
          wx.showToast({
            title: '登录成功',
            icon: 'success',
            duration: 1500
          });
          
          // 延迟跳转，让用户看到成功提示
          setTimeout(() => {
            wx.redirectTo({
              url: '/pages/profile/profile'
            });
          }, 1500);
        } else {
          wx.showToast({
            title: '登录失败',
            icon: 'none'
          });
        }
      },
      fail: () => {
        wx.showToast({
          title: '登录失败',
          icon: 'none'
        });
      }
    });
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
  },

  // 继续使用应用
  continueToApp() {
    wx.redirectTo({
      url: '/pages/profile/profile'
    });
  }
});
