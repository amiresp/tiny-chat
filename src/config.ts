export type locale = {code: 'fa' | 'en'; dir: 'rtl' | 'ltr'; $code: string};

export const mainNavigation = [
  {
    id: 'home',
    icon: 'home-2',
  },
  {
    id: 'about',
    icon: 'info-circle',
  },
] as const;

export const locales: locale[] = [
  {code: 'fa', dir: 'rtl', $code: 'فارسی'},
  {code: 'en', dir: 'ltr', $code: 'English'},
];

export const wordList: Array<object> = [
  {title: 'کارمند', level: 0},
  {title: 'ایستگاه صلواتی', level: 0},
  {title: 'اختاپوس', level: 0},
  {title: 'رادیولوژی', level: 0},
  {title: 'سیمرغ', level: 0},
  {title: 'ایزوگام', level: 0},
  {title: 'رژ گونه', level: 1},
  {title: ' ارباب رجوع', level: 1},
  {title: ' سواحل آنتالیا', level: 1},
  {title: 'نازک نارنجی', level: 1},
  {title: ' اسب تروا', level: 1},
  {title: 'کلاه قرمزی', level: 1},

  {title: 'اهرام ثلاثه مصر', level: 2},
  {title: ' کوچه علی چپ', level: 2},
  {title: ' قزن قفلی لباس', level: 2},
  {title: '	گل گاو زبان', level: 2},
  {title: 'خواننده زیر زمینی', level: 2},
  {title: 'خواننده زیر زمینی', level: 2},
];
