import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

// Bangla is the default, as on the school's government portal. The choice is remembered per visitor.
const BN = {
  Search: 'অনুসন্ধান',
  'Select menu': 'মেনু নির্বাচন করুন', Home: 'হোম', 'Sign in': 'সাইন ইন',
  Noticeboard: 'নোটিশ বোর্ড', News: 'খবর', 'View archive': 'আর্কাইভ দেখুন', 'There are no notices at the moment.': 'এই মুহূর্তে কোনো নোটিশ নেই।',
  Pinned: 'পিন করা', 'Video and map': 'ভিডিও ও ম্যাপ', All: 'সকল', 'National anthem': 'জাতীয় সঙ্গীত', 'Social media': 'সামাজিক যোগাযোগ',
  'Emergency contacts': 'জরুরি যোগাযোগ', 'View all services': 'সকল সেবা দেখুন', 'Show fewer': 'কম দেখুন',
  'Everything published on this website is kept up to date by the school.': 'এই ওয়েবসাইটে প্রকাশিত সকল তথ্য সংশ্লিষ্ট প্রতিষ্ঠান কর্তৃক নিয়মিত হালনাগাদ করা হয়। তথ্যের যথার্থতা, নির্ভুলতা ও নির্ভরযোগ্যতা নিশ্চিত করতে প্রতিষ্ঠান সর্বদা সচেষ্ট।',
  'Site last updated:': 'সাইটটি শেষ হাল-নাগাদ করা হয়েছে:',
  'Click to share this content': 'এই কনটেন্টটি শেয়ার করতে ক্লিক করুন', 'Give your feedback': 'আপনার মতামত প্রদান করুন', 'Copy link': 'লিংক কপি করুন',
  Accessibility: 'এক্সেসিবিলিটি', 'Larger text': 'লেখা বড় করুন', 'Smaller text': 'লেখা ছোট করুন', 'High contrast': 'উচ্চ কনট্রাস্ট', Grayscale: 'গ্রেস্কেল', 'Underline links': 'লিংক আন্ডারলাইন', Reset: 'রিসেট', 'Back to top': 'উপরে যান', Close: 'বন্ধ করুন', 'Skip to content': 'কন্টেন্টে চলে যান',
  Notices: 'নোটিশ', Results: 'ফলাফল', Admission: 'ভর্তি', Facilities: 'সুযোগ-সুবিধা', Achievements: 'কৃতিত্ব', 'Media & Gallery': 'মিডিয়া ও গ্যালারি', Mission: 'লক্ষ্য', Vision: 'উদ্দেশ্য',
  'Page not found': 'পৃষ্ঠাটি পাওয়া যায়নি', 'This page does not exist or has been turned off.': 'এই পৃষ্ঠাটি নেই অথবা বন্ধ করা হয়েছে।', 'Back to home': 'হোমে ফিরে যান',
  'Search results': 'অনুসন্ধানের ফলাফল', 'No results found.': 'কোনো তথ্য পাওয়া যায়নি।', 'Enter at least two letters.': 'কমপক্ষে দুটি অক্ষর লিখুন।',
  'Nothing has been added here yet.': 'এখানে এখনো কিছু যোগ করা হয়নি।', Address: 'ঠিকানা', Phone: 'ফোন', Email: 'ইমেইল', 'Office hours': 'অফিস সময়', Other: 'অন্যান্য', Available: 'বিদ্যমান', Previous: 'পূর্ববর্তী', Next: 'পরবর্তী',
  'All notices': 'সকল নোটিশ', 'Notice not found': 'নোটিশটি পাওয়া যায়নি', 'Open PDF': 'পিডিএফ খুলুন', 'PDF document': 'পিডিএফ ফাইল',
  'Choose the exam and class, then enter the student\'s details to see the marksheet.': 'পরীক্ষা ও শ্রেণি নির্বাচন করে শিক্ষার্থীর তথ্য দিলে মার্কশিট দেখা যাবে।',
  'No results have been published yet.': 'এখনো কোনো ফলাফল প্রকাশ করা হয়নি।', Exam: 'পরীক্ষা', 'Select exam': 'পরীক্ষা নির্বাচন করুন', Class: 'শ্রেণি', 'Select class': 'শ্রেণি নির্বাচন করুন',
  'Roll number': 'রোল নম্বর', 'Date of birth': 'জন্ম তারিখ', 'Registration number': 'রেজিস্ট্রেশন নম্বর', 'View result': 'ফলাফল দেখুন', 'Searching...': 'খোঁজা হচ্ছে...', Print: 'প্রিন্ট',
  Student: 'শিক্ষার্থী', Roll: 'রোল', Registration: 'রেজিস্ট্রেশন', Group: 'বিভাগ', Father: 'পিতা', Mother: 'মাতা', Passed: 'উত্তীর্ণ', Failed: 'অনুত্তীর্ণ', Result: 'ফলাফল', GPA: 'জিপিএ', Grade: 'গ্রেড', of: 'মোট', 'Position of': 'অবস্থান, মোট',
  Subject: 'বিষয়', Full: 'পূর্ণমান', Marks: 'প্রাপ্ত নম্বর', Point: 'পয়েন্ট', Absent: 'অনুপস্থিত', '4th subject': '৪র্থ বিষয়',
  'Apply online, then track your application with the application number.': 'অনলাইনে আবেদন করুন এবং আবেদন নম্বর দিয়ে অবস্থা জানুন।', 'Already applied?': 'ইতোমধ্যে আবেদন করেছেন?', 'Check your application status': 'আবেদনের অবস্থা দেখুন',
  'Submit application': 'আবেদন জমা দিন', 'Submitting...': 'জমা দেওয়া হচ্ছে...', Select: 'নির্বাচন করুন', 'Application received': 'আবেদন গৃহীত হয়েছে',
  'Keep this application number. You need it with your mobile number to check the status.': 'এই আবেদন নম্বরটি সংরক্ষণ করুন। অবস্থা জানতে মোবাইল নম্বরসহ এটি প্রয়োজন হবে।', 'Check application status': 'আবেদনের অবস্থা দেখুন',
  'Application status': 'আবেদনের অবস্থা', 'Application number': 'আবেদন নম্বর', 'Contact mobile': 'যোগাযোগের মোবাইল', 'Check status': 'অবস্থা দেখুন', 'Checking...': 'যাচাই করা হচ্ছে...',
  'Applied on': 'আবেদনের তারিখ', Status: 'অবস্থা', Fee: 'ফি', 'No fee': 'ফি নেই', Session: 'সেশন',
  Submitted: 'জমা হয়েছে', 'Under review': 'যাচাই চলছে', Accepted: 'গৃহীত', Waitlisted: 'অপেক্ষমাণ', 'Not accepted': 'গৃহীত হয়নি', 'Not paid': 'পরিশোধ হয়নি', 'Waiting for confirmation': 'নিশ্চিতকরণের অপেক্ষায়', Paid: 'পরিশোধিত',
  'Pay the application fee:': 'আবেদন ফি পরিশোধ করুন:', 'Send to:': 'পাঠান:', 'Transaction ID': 'ট্রানজেকশন আইডি', 'Deposit slip or reference number': 'জমা রসিদ বা রেফারেন্স নম্বর', 'Please wait...': 'অপেক্ষা করুন...', 'Continue to payment': 'পেমেন্টে যান', Confirm: 'নিশ্চিত করুন',
  'Please contact the school office to pay the fee of': 'ফি পরিশোধের জন্য বিদ্যালয় অফিসে যোগাযোগ করুন। ফি:',
  'Payment successful': 'পেমেন্ট সফল হয়েছে', 'Payment not completed': 'পেমেন্ট সম্পন্ন হয়নি', 'Thank you. Your payment was received. Reference:': 'ধন্যবাদ। আপনার পেমেন্ট গৃহীত হয়েছে। রেফারেন্স:',
  'The payment was not confirmed. You can try again from the status page. If money was deducted, contact the school with your application number.': 'পেমেন্ট নিশ্চিত হয়নি। অবস্থা পৃষ্ঠা থেকে আবার চেষ্টা করতে পারেন। টাকা কেটে থাকলে আবেদন নম্বরসহ বিদ্যালয়ে যোগাযোগ করুন।',
};

Object.assign(BN, {
  History: 'ইতিহাস', 'Our Pride': 'আমাদের গর্ব', Albums: 'অ্যালবাম', photos: 'টি ছবি', 'Back to history': 'ইতিহাসে ফিরে যান', 'View full history': 'সম্পূর্ণ ইতিহাস দেখুন', Education: 'শিক্ষাগত যোগ্যতা',
  'Message from the Head Teacher': 'প্রধান শিক্ষকের বাণী', 'About the School': 'বিদ্যালয় সম্পর্কে', 'Read the full message': 'সম্পূর্ণ বাণী পড়ুন', 'Read more': 'আরও পড়ুন',
  Officers: 'কর্মকর্তাবৃন্দ', Teachers: 'শিক্ষকবৃন্দ', Staff: 'কর্মচারীবৃন্দ', 'Information officer': 'তথ্য প্রদানকারী কর্মকর্তা', Departments: 'বিভাগসমূহ',
  'View as table': 'টেবিল আকারে দেখুন', 'View as cards': 'কার্ড আকারে দেখুন', 'Sort by': 'ক্রম অনুসারে', 'Items per page': 'পৃষ্ঠা আইটেম', Default: 'ডিফল্ট', Name: 'নাম', Designation: 'পদবি', 'Office phone': 'ফোন (অফিস)', Intercom: 'ইন্টারকম', Fax: 'ফ্যাক্স',
  'No.': 'নং', ID: 'আইডি', 'Batch (BCS)': 'ব্যাচ (বিসিএস)', Faculty: 'অনুষদ', Department: 'বিভাগ', 'Home phone': 'ফোন (বাসা)', Mobile: 'মোবাইল', 'Room number': 'কক্ষ নম্বর', Photo: 'ছবি', CV: 'জীবনবৃত্তান্ত', 'View CV': 'জীবনবৃত্তান্ত দেখুন',
  'Meeting calendar': 'সভার ক্যালেন্ডার', 'No events found.': 'কোনো কর্মসূচি পাওয়া যায়নি।', 'Past events': 'পূর্ববর্তী কর্মসূচি', 'All events': 'সকল কর্মসূচি', 'All news': 'সকল খবর',
  Publications: 'প্রকাশনা', Title: 'শিরোনাম', Category: 'ধরন', Date: 'তারিখ', Download: 'ডাউনলোড', 'Co-curricular activities': 'সহশিক্ষা কার্যক্রম',
  Subject: 'বিষয়', 'Your message': 'আপনার বার্তা', Send: 'পাঠান', 'Thank you. Your feedback has been sent to the school.': 'ধন্যবাদ। আপনার মতামত বিদ্যালয়ে পাঠানো হয়েছে।',
});

const STORE_KEY = 'site-lang';
const LangContext = createContext(null);

function readStored() {
  try {
    return localStorage.getItem(STORE_KEY) === 'en' ? 'en' : 'bn';
  } catch {
    return 'bn';
  }
}

export function LangProvider({ children }) {
  const [lang, setLang] = useState(readStored);

  useEffect(() => {
    document.documentElement.lang = lang === 'bn' ? 'bn' : 'en';
    try {
      localStorage.setItem(STORE_KEY, lang);
    } catch {
      /* the choice just will not be remembered */
    }
  }, [lang]);

  const t = useCallback((text) => (lang === 'bn' ? BN[text] ?? text : text), [lang]);
  // Admin-entered text: use the current language, falling back to whichever version exists.
  const pick = useCallback((bn, en) => (lang === 'bn' ? bn || en : en || bn) || '', [lang]);
  const value = useMemo(() => ({ lang, setLang, t, pick }), [lang, t, pick]);
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export const useLang = () => useContext(LangContext);
