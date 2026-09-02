/**
 * UI copy, in both supported languages.
 *
 * `en` is the source of truth: its keys define the `TranslationKey` union, so
 * a missing or misspelled Persian key is a compile error rather than a blank
 * label at runtime.
 */
export const en = {
  // --- shell ---------------------------------------------------------------
  'app.name': 'task',
  'app.tagline': 'LinkedIn profile search',
  'nav.search': 'Search',
  'nav.how': 'How it works',
  'nav.api': 'API',
  'nav.openSearch': 'Open search',
  'lang.toggle': 'فارسی',
  'lang.label': 'Change language',

  // --- hero ----------------------------------------------------------------
  'hero.badge': 'Full-text search · faceted filters · BM25 ranking',
  'hero.title.a': 'Search',
  'hero.title.b': 'profiles',
  'hero.title.c': 'the way recruiters think',
  'hero.subtitle':
    'A keyword engine over a LinkedIn dataset — free-text search across names, titles, skills, employers and education, narrowed by filters that actually compose.',
  'hero.cta.primary': 'Start searching',
  'hero.cta.secondary': 'How it works',
  'hero.stat.profiles': 'Profiles',
  'hero.stat.skills': 'Distinct skills',
  'hero.stat.companies': 'Companies',
  'hero.stat.positions': 'Positions indexed',
  'hero.scroll': 'Scroll',

  // --- feature strip -------------------------------------------------------
  'feature.1.title': 'Ranked, not just matched',
  'feature.1.body':
    'BM25 scores every hit and weights the field it came from — a name match outranks the same word buried in a bio.',
  'feature.2.title': 'Filters that compose',
  'feature.2.body':
    'Values inside one filter are OR-ed, filters are AND-ed together. Skills can additionally require every selected value.',
  'feature.3.title': 'Type-ahead everywhere',
  'feature.3.body':
    'Filter values come from live facet counts, so you only ever pick a value that returns results.',

  // --- search --------------------------------------------------------------
  'search.heading': 'Search the dataset',
  'search.placeholder': 'Try “civil engineer”, “security clearance”, “northwestern”…',
  'search.hint': 'Use "quotes" for an exact phrase and -minus to exclude a word.',
  'search.clear': 'Clear',
  'search.filters': 'Filters',
  'search.filters.show': 'Show filters',
  'search.filters.hide': 'Hide filters',
  'search.reset': 'Reset all',
  'search.activeFilters': '{count} active',
  'search.sort': 'Sort by',
  'search.sort.relevance': 'Relevance',
  'search.sort.experience_desc': 'Most experience',
  'search.sort.experience_asc': 'Least experience',
  'search.sort.connections_desc': 'Most connections',
  'search.sort.name_asc': 'Name (A–Z)',

  // --- filters -------------------------------------------------------------
  'filter.skills': 'Skills',
  'filter.jobTitle': 'Job title',
  'filter.company': 'Company',
  'filter.industry': 'Industry',
  'filter.country': 'Country',
  'filter.level': 'Seniority',
  'filter.degree': 'Degree',
  'filter.school': 'School',
  'filter.experience': 'Years of experience',
  'filter.search': 'Search {field}…',
  'filter.empty': 'No matches',
  'filter.selected': '{count} selected',
  'filter.skillMatch.any': 'Any skill',
  'filter.skillMatch.all': 'All skills',
  'filter.skillMatch.hint': 'Require every selected skill',
  'filter.min': 'Min',
  'filter.max': 'Max',
  'filter.clear': 'Clear',

  // --- results -------------------------------------------------------------
  'results.count': '{total} profiles',
  'results.countOne': '1 profile',
  'results.took': 'in {ms} ms',
  'results.engine': 'engine: {engine}',
  'results.empty.title': 'No profiles match',
  'results.empty.body': 'Try removing a filter, or search for a broader keyword.',
  'results.empty.action': 'Reset filters',
  'results.error.title': 'Could not reach the API',
  'results.error.body': 'Make sure the backend is running on port 4000, then retry.',
  'results.error.action': 'Retry',
  'results.loading': 'Searching…',
  'results.skillsMore': '+{count} more',
  'results.viewProfile': 'View profile',
  'results.score': 'score {score}',

  // --- profile card / drawer ----------------------------------------------
  'profile.at': 'at',
  'profile.years': '{years} yrs',
  'profile.connections': '{count} connections',
  'profile.close': 'Close',
  'profile.summary': 'Summary',
  'profile.skills': 'Skills',
  'profile.experience': 'Experience',
  'profile.education': 'Education',
  'profile.interests': 'Interests',
  'profile.current': 'Current',
  'profile.present': 'Present',
  'profile.noSummary': 'No summary on this profile.',
  'profile.linkedin': 'LinkedIn profile',
  'profile.loading': 'Loading profile…',

  // --- pagination ----------------------------------------------------------
  'page.prev': 'Previous',
  'page.next': 'Next',
  'page.of': 'Page {page} of {pages}',
  'page.perPage': 'Per page',

  // --- how it works --------------------------------------------------------
  'how.heading': 'How it works',
  'how.subtitle': 'Three layers, one request path.',
  'how.step1.title': 'Data',
  'how.step1.body':
    'The CSV is repaired, normalised and loaded into SQLite: scalar columns for filters, link tables for skills and degrees, and an FTS5 inverted index for keyword search.',
  'how.step2.title': 'API',
  'how.step2.body':
    'Express validates every query with a schema, then hands a typed query object to a search engine behind an interface. SQLite is the default; Elasticsearch is a drop-in swap.',
  'how.step3.title': 'Interface',
  'how.step3.body':
    'React debounces your keystrokes, cancels superseded requests, and mirrors state into the URL so any search can be shared as a link.',


  // --- api playground ------------------------------------------------------
  'api.heading': 'Try the API',
  'api.subtitle':
    'A live console against the running backend. Edit the path, send the request, read the raw response.',
  'api.path': 'Request path',
  'api.send': 'Send',
  'api.sending': 'Sending…',
  'api.took': '{ms} ms',
  'api.size': '{kb} KB',
  'api.endpoints': 'Endpoint reference',
  'api.preset.search': 'Keyword search',
  'api.preset.filters': 'Filters combined',
  'api.preset.explain': 'Explain the query',
  'api.preset.suggest': 'Type-ahead',
  'api.preset.facets': 'Facet counts',
  'api.preset.stats': 'Dataset stats',
  'api.preset.error': 'Validation error',
  'api.ep.search': 'Keyword search with filters, sorting and pagination',
  'api.ep.profile': 'One full profile — skills, experience, education',
  'api.ep.facets': 'Filter values with counts',
  'api.ep.suggest': 'Type-ahead across skills, titles, companies, names',
  'api.ep.stats': 'Dataset totals',
  'api.ep.health': 'Liveness probe',

  // --- explain panel -------------------------------------------------------
  'explain.show': 'How was this ranked?',
  'explain.hide': 'Hide details',
  'explain.title': 'Query execution',
  'explain.keyword': 'Keyword parsed as',
  'explain.ranking': 'Ranking',
  'explain.weights': 'Field weights',
  'explain.filters': 'Filters applied',
  'explain.sort': 'Order by',
  'explain.sql': 'Statement',
  'explain.none': 'No keyword — results are in a deterministic order.',

  // --- suggestions ---------------------------------------------------------
  'suggest.skill': 'skill',
  'suggest.title': 'job title',
  'suggest.company': 'company',
  'suggest.name': 'person',

  // --- mobile --------------------------------------------------------------
  'filters.done': 'Show results',
  'filters.sheet': 'Filters',

  // --- footer --------------------------------------------------------------
  'footer.built': 'Built for the Cyberyan full-stack trial task.',
  'footer.docs': 'API reference',
  'footer.repo': 'README',
} as const;

export type TranslationKey = keyof typeof en;

export const fa: Record<TranslationKey, string> = {
  // --- shell ---------------------------------------------------------------
  'app.name': 'تسک',
  'app.tagline': 'جست‌وجوی پروفایل‌های لینکدین',
  'nav.search': 'جست‌وجو',
  'nav.how': 'چطور کار می‌کند',
  'nav.api': 'ای‌پی‌آی',
  'nav.openSearch': 'رفتن به جست‌وجو',
  'lang.toggle': 'English',
  'lang.label': 'تغییر زبان',

  // --- hero ----------------------------------------------------------------
  'hero.badge': 'جست‌وجوی تمام‌متن · فیلتر ترکیبی · رتبه‌بندی BM25',
  'hero.title.a': 'جست‌وجوی',
  'hero.title.b': 'پروفایل‌ها',
  'hero.title.c': 'به همان شکلی که فکر می‌کنید',
  'hero.subtitle':
    'یک موتور جست‌وجو روی دیتاست لینکدین — جست‌وجوی آزاد در نام، عنوان شغلی، مهارت‌ها، شرکت‌ها و سوابق تحصیلی، همراه با فیلترهایی که با هم ترکیب می‌شوند.',
  'hero.cta.primary': 'شروع جست‌وجو',
  'hero.cta.secondary': 'چطور کار می‌کند',
  'hero.stat.profiles': 'پروفایل',
  'hero.stat.skills': 'مهارت یکتا',
  'hero.stat.companies': 'شرکت',
  'hero.stat.positions': 'سابقه شغلی',
  'hero.scroll': 'پایین',

  // --- feature strip -------------------------------------------------------
  'feature.1.title': 'رتبه‌بندی، نه فقط تطبیق',
  'feature.1.body':
    'الگوریتم BM25 به هر نتیجه امتیاز می‌دهد و به فیلدی که کلمه در آن پیدا شده وزن می‌دهد؛ تطبیق در نام بالاتر از همان کلمه در متن معرفی می‌نشیند.',
  'feature.2.title': 'فیلترهای ترکیب‌شونده',
  'feature.2.body':
    'مقادیر درون یک فیلتر با OR و فیلترها با هم با AND ترکیب می‌شوند. برای مهارت‌ها می‌توانید وجود همهٔ موارد انتخابی را الزامی کنید.',
  'feature.3.title': 'پیشنهاد هم‌زمان',
  'feature.3.body':
    'مقادیر فیلترها از شمارش زندهٔ داده‌ها می‌آید؛ پس همیشه گزینه‌ای را انتخاب می‌کنید که نتیجه دارد.',

  // --- search --------------------------------------------------------------
  'search.heading': 'جست‌وجو در دیتاست',
  'search.placeholder': 'مثلاً «civil engineer»، «security clearance»، «northwestern»…',
  'search.hint': 'برای عبارت دقیق از "گیومه" و برای حذف یک کلمه از -منها استفاده کنید.',
  'search.clear': 'پاک کردن',
  'search.filters': 'فیلترها',
  'search.filters.show': 'نمایش فیلترها',
  'search.filters.hide': 'بستن فیلترها',
  'search.reset': 'پاک کردن همه',
  'search.activeFilters': '{count} فعال',
  'search.sort': 'مرتب‌سازی',
  'search.sort.relevance': 'مرتبط‌ترین',
  'search.sort.experience_desc': 'بیشترین سابقه',
  'search.sort.experience_asc': 'کمترین سابقه',
  'search.sort.connections_desc': 'بیشترین ارتباط',
  'search.sort.name_asc': 'نام (الفبا)',

  // --- filters -------------------------------------------------------------
  'filter.skills': 'مهارت‌ها',
  'filter.jobTitle': 'عنوان شغلی',
  'filter.company': 'شرکت',
  'filter.industry': 'صنعت',
  'filter.country': 'کشور',
  'filter.level': 'سطح ارشدیت',
  'filter.degree': 'مدرک تحصیلی',
  'filter.school': 'دانشگاه',
  'filter.experience': 'سال‌های سابقه',
  'filter.search': 'جست‌وجوی {field}…',
  'filter.empty': 'موردی پیدا نشد',
  'filter.selected': '{count} انتخاب‌شده',
  'filter.skillMatch.any': 'هر مهارت',
  'filter.skillMatch.all': 'همهٔ مهارت‌ها',
  'filter.skillMatch.hint': 'وجود همهٔ مهارت‌های انتخابی الزامی باشد',
  'filter.min': 'حداقل',
  'filter.max': 'حداکثر',
  'filter.clear': 'پاک کردن',

  // --- results -------------------------------------------------------------
  'results.count': '{total} پروفایل',
  'results.countOne': '۱ پروفایل',
  'results.took': 'در {ms} میلی‌ثانیه',
  'results.engine': 'موتور: {engine}',
  'results.empty.title': 'پروفایلی پیدا نشد',
  'results.empty.body': 'یکی از فیلترها را بردارید یا با کلمهٔ کلی‌تری جست‌وجو کنید.',
  'results.empty.action': 'پاک کردن فیلترها',
  'results.error.title': 'ارتباط با سرور برقرار نشد',
  'results.error.body': 'مطمئن شوید بک‌اند روی پورت ۴۰۰۰ در حال اجراست و دوباره تلاش کنید.',
  'results.error.action': 'تلاش دوباره',
  'results.loading': 'در حال جست‌وجو…',
  'results.skillsMore': '{count}+ مورد دیگر',
  'results.viewProfile': 'مشاهدهٔ پروفایل',
  'results.score': 'امتیاز {score}',

  // --- profile card / drawer ----------------------------------------------
  'profile.at': 'در',
  'profile.years': '{years} سال',
  'profile.connections': '{count} ارتباط',
  'profile.close': 'بستن',
  'profile.summary': 'معرفی',
  'profile.skills': 'مهارت‌ها',
  'profile.experience': 'سوابق شغلی',
  'profile.education': 'سوابق تحصیلی',
  'profile.interests': 'علاقه‌مندی‌ها',
  'profile.current': 'شغل فعلی',
  'profile.present': 'اکنون',
  'profile.noSummary': 'برای این پروفایل معرفی ثبت نشده است.',
  'profile.linkedin': 'پروفایل لینکدین',
  'profile.loading': 'در حال بارگذاری…',

  // --- pagination ----------------------------------------------------------
  'page.prev': 'قبلی',
  'page.next': 'بعدی',
  'page.of': 'صفحهٔ {page} از {pages}',
  'page.perPage': 'در هر صفحه',

  // --- how it works --------------------------------------------------------
  'how.heading': 'چطور کار می‌کند',
  'how.subtitle': 'سه لایه، یک مسیر درخواست.',
  'how.step1.title': 'داده',
  'how.step1.body':
    'فایل CSV ترمیم و نرمال‌سازی می‌شود و در SQLite می‌نشیند: ستون‌های ساده برای فیلترها، جدول‌های واسط برای مهارت‌ها و مدارک، و یک ایندکس معکوس FTS5 برای جست‌وجوی کلیدواژه‌ای.',
  'how.step2.title': 'ای‌پی‌آی',
  'how.step2.body':
    'اکسپرس هر درخواست را با اسکیما اعتبارسنجی می‌کند و یک کوئری تایپ‌شده به موتور جست‌وجو می‌دهد که پشت یک اینترفیس قرار دارد. SQLite پیش‌فرض است و الستیک‌سرچ جایگزین مستقیم آن.',
  'how.step3.title': 'رابط کاربری',
  'how.step3.body':
    'ری‌اکت تایپ شما را با تأخیر کوتاه ارسال می‌کند، درخواست‌های قدیمی را لغو می‌کند و وضعیت را در آدرس صفحه نگه می‌دارد تا هر جست‌وجو قابل اشتراک باشد.',


  // --- api playground ------------------------------------------------------
  'api.heading': 'ای‌پی‌آی را امتحان کنید',
  'api.subtitle':
    'یک کنسول زنده روی بک‌اند در حال اجرا. مسیر را ویرایش کنید، درخواست را بفرستید و پاسخ خام را ببینید.',
  'api.path': 'مسیر درخواست',
  'api.send': 'ارسال',
  'api.sending': 'در حال ارسال…',
  'api.took': '{ms} میلی‌ثانیه',
  'api.size': '{kb} کیلوبایت',
  'api.endpoints': 'فهرست اندپوینت‌ها',
  'api.preset.search': 'جست‌وجوی کلیدواژه',
  'api.preset.filters': 'ترکیب فیلترها',
  'api.preset.explain': 'توضیح کوئری',
  'api.preset.suggest': 'پیشنهاد هم‌زمان',
  'api.preset.facets': 'شمارش فیلترها',
  'api.preset.stats': 'آمار دیتاست',
  'api.preset.error': 'خطای اعتبارسنجی',
  'api.ep.search': 'جست‌وجوی کلیدواژه‌ای با فیلتر، مرتب‌سازی و صفحه‌بندی',
  'api.ep.profile': 'یک پروفایل کامل — مهارت‌ها، سوابق شغلی و تحصیلی',
  'api.ep.facets': 'مقادیر فیلترها به همراه تعداد',
  'api.ep.suggest': 'پیشنهاد هم‌زمان روی مهارت، عنوان شغلی، شرکت و نام',
  'api.ep.stats': 'آمار کلی دیتاست',
  'api.ep.health': 'بررسی سلامت سرویس',

  // --- explain panel -------------------------------------------------------
  'explain.show': 'این نتایج چطور رتبه‌بندی شدند؟',
  'explain.hide': 'بستن جزئیات',
  'explain.title': 'نحوهٔ اجرای کوئری',
  'explain.keyword': 'کلیدواژه تفسیر شد به',
  'explain.ranking': 'رتبه‌بندی',
  'explain.weights': 'وزن فیلدها',
  'explain.filters': 'فیلترهای اعمال‌شده',
  'explain.sort': 'ترتیب',
  'explain.sql': 'دستور اجراشده',
  'explain.none': 'بدون کلیدواژه — نتایج با ترتیب ثابت نمایش داده می‌شوند.',

  // --- suggestions ---------------------------------------------------------
  'suggest.skill': 'مهارت',
  'suggest.title': 'عنوان شغلی',
  'suggest.company': 'شرکت',
  'suggest.name': 'شخص',

  // --- mobile --------------------------------------------------------------
  'filters.done': 'نمایش نتایج',
  'filters.sheet': 'فیلترها',

  // --- footer --------------------------------------------------------------
  'footer.built': 'ساخته‌شده برای تسک آزمایشی فول‌استک سایبریان.',
  'footer.docs': 'مستندات API',
  'footer.repo': 'راهنمای اجرا',
};

export const dictionaries = { en, fa } as const;
export type Language = keyof typeof dictionaries;
