import { Layout } from '@/utils/routerHelper'

const { t } = useI18n()
/**
 * redirect: noredirect        当设置 noredirect 的时候该路由在面包屑导航中不可被点击
 * name:'router-name'          设定路由的名字，一定要填写不然使用<keep-alive>时会出现各种问题
 * meta : {
 hidden: true              当设置 true 的时候该路由不会再侧边栏出现 如404，login等页面(默认 false)

 alwaysShow: true          当你一个路由下面的 children 声明的路由大于1个时，自动会变成嵌套的模式，
 只有一个时，会将那个子路由当做根路由显示在侧边栏，
 若你想不管路由下面的 children 声明的个数都显示你的根路由，
 你可以设置 alwaysShow: true，这样它就会忽略之前定义的规则，
 一直显示根路由(默认 false)

 title: 'title'            设置该路由在侧边栏和面包屑中展示的名字

 icon: 'svg-name'          设置该路由的图标

 noCache: true             如果设置为true，则不会被 <keep-alive> 缓存(默认 false)

 breadcrumb: false         如果设置为false，则不会在breadcrumb面包屑中显示(默认 true)

 affix: true               如果设置为true，则会一直固定在tag项中(默认 false)

 noTagsView: true          如果设置为true，则不会出现在tag中(默认 false)

 activeMenu: '/dashboard'  显示高亮的路由路径

 followAuth: '/dashboard'  跟随哪个路由进行权限过滤

 canTo: true               设置为true即使hidden为true，也依然可以进行路由跳转(默认 false)
 }
 **/
const remainingRouter: AppRouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/stocks-front/home',
    name: 'Root',
        meta: {}
  },
  {
    path: '/stocks-front/home',
    component: () => import('@/views/stocks-front/home/index.vue'),
    name: 'StocksFrontHome',
    meta: { title: '股票期权首页', hidden: true, noTagsView: true }
  },
  {
    path: '/stocks-front/video',
    component: () => import('@/views/stocks-front/video/index.vue'),
    name: 'StocksFrontVideo',
    meta: { title: '期权视频教学', hidden: true, noTagsView: true }
  },
  {
    path: '/stocks-front/inquiry',
    component: () => import('@/views/stocks-front/inquiry/index.vue'),
    name: 'StocksFrontInquiry',
    meta: { title: '股票期权询价', hidden: true, noTagsView: true }
  },
  {
    path: '/stocks-front/filetest',
    component: () => import('@/views/stocks-front/filetest/index.vue'),
    name: 'StocksFileTest',
    meta: { title: '文件上传测试', hidden: true, noTagsView: true }
  },
  {
    path: '/stocks-front/filetest/stsdelete',
    component: () => import('@/views/stocks-front/filetest/stsdelete.vue'),
    name: 'StocksFileSTSDeleteTest',
    meta: { title: 'STS 文件删除测试', hidden: true, noTagsView: true }
  },
  {
    path: '/stocks-front/videodetail/:id',
    component: () => import('@/views/stocks-front/videodetail/index.vue'),
    name: 'StocksVideoDetail',
    meta: { title: '视频详情', hidden: true, noTagsView: true }
  },
  {
    path: '/stocks-front/login',
    component: () => import('@/views/stocks-front/login/index.vue'),
    name: 'StocksLogin',
    meta: { title: '股票系统登录', hidden: true, noTagsView: true }
  },
  {
    path: '/stocks-front/userDetail',
    component: () => import('@/views/stocks-front/userDetail/index.vue'),
    name: 'StocksUserDetail',
    meta: { title: '个人中心', hidden: true, noTagsView: true }
  },
  {
    path: '/stocks-front/vip_upgrade',
    component: () => import('@/views/stocks-front/vip_upgrade/index.vue'),
    name: 'StocksVipUpgrade',
    meta: { title: 'VIP充值升级', hidden: true, noTagsView: true }
  },
  {
    path: '/stocks-front/debug',
    component: () => import('@/views/stocks-front/debug/index.vue'),
    name: 'StocksDebug',
    meta: { title: '登录状态调试', hidden: true, noTagsView: true }
  },
  {
    path: '/pay/cashier',
    component: () => import('@/views/pay/cashier/index.vue'),
    name: 'PayCashier',
    meta: { title: '支付收银台', hidden: true, noTagsView: true }
  },
  {
    path: '/stocks-front/pay/cashier',
    component: () => import('@/views/stocks-front/pay/cashier/index.vue'),
    name: 'StocksFrontPayCashier',
    meta: { title: '支付收银台', hidden: true, noTagsView: true }
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('@/views/stocks-front/NotFound.vue'),
    meta: { title: '页面未找到', hidden: true }
  }
]

export default remainingRouter
