// index.ts
// 获取应用实例
const app = getApp<IAppOption>()
const defaultAvatarUrl = 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0'

interface PageData {
  userInfo: WechatMiniprogram.UserInfo | null;
}

Page<PageData>({
  data: {
    userInfo: null
  },

  onLoad() {
    // 检查登录状态
    const userInfo = wx.getStorageSync('userInfo');
    if (userInfo) {
      wx.redirectTo({
        url: '/pages/home/home'
      });
    } else {
      wx.redirectTo({
        url: '/pages/login/login'
      });
    }
  },

  onShow() {
    // 每次显示页面时检查登录状态
    const userInfo = wx.getStorageSync('userInfo');
    if (!userInfo) {
      wx.redirectTo({
        url: '/pages/login/login'
      });
    }
  },

  onBluetoothTest() {
    wx.navigateTo({
      url: '/pages/bluetooth-test/bluetooth-test',
      fail: (error) => {
        console.error('跳转失败:', error);
        wx.showToast({
          title: '页面跳转失败',
          icon: 'none'
        });
      }
    });
  }
});
