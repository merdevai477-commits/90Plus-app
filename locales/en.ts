/**
 * English Translations
 */

export const en = {
  common: {
    loading: 'Loading...',
    error: 'Error',
    errorLoadingMatches: 'Failed to load matches. Please try again.',
    retry: 'Retry',
    cancel: 'Cancel',
    confirm: 'Confirm',
    save: 'Save',
    delete: 'Delete',
    done: 'Done',
    close: 'Close',
    unknown: 'Unknown',
    unavailable: 'Unavailable',
    // New common keys
    fillAllFields: 'Please fill all fields',
    enterName: 'Please enter your name',
    loginServiceUnavailable: 'Login service unavailable',
    signupServiceUnavailable: 'Signup service unavailable',
    operationFailed: 'Operation failed',
    loginError: 'Login Error',
    checkRedirectUrls: 'Login failed. Please check Redirect URLs in Clerk Dashboard.',
    verifyEmail: 'Please verify your email',
    alert: 'Alert',
    warning: 'Warning',
    success: 'Success',
    loggingIn: 'Logging in...',
    signingUp: 'Signing up...',
    errorOccurred: 'An error occurred',
  },

  leagues: {
    title: '⚽ World Matches',
    subtitle: 'Best platform to follow matches, predictions and statistics',
    todayMatches: "Today's Matches",
    live: 'Live',
    today: 'Today',
    upcoming: 'Upcoming',
    topLeagues: 'Top Leagues',
    searchPlaceholder: 'Search for matches, teams, leagues or countries...',
    noMatches: 'No matches',
    noMatchesAvailable: 'No matches available at the moment',
    noMatchesFound: 'No matches found matching your search',
    loadingMatches: 'Loading matches...',
    results: 'Results',
    predictions: 'Predictions',
    accuracy: 'Prediction Accuracy',
    accuracyPercent: 'Prediction Accuracy',
    points: 'Points',
    streak: 'Streak',
    bestStreak: 'Best Streak',
    totalPredictions: 'Total Predictions',
    correctPredictions: 'Correct Predictions',
    usingCache: 'Cached Data - Fast',
    refreshing: 'Refreshing...',

    // Stats Cards
    todayMatchesCount: "Today's Matches",
    predictionAccuracy: 'Prediction Accuracy',
    bestStreakCount: 'Best Streak',
    currentStreak: 'Streak',

    // Filter Labels
    filterAll: 'All',
    filterLive: 'Live',
    filterToday: 'Today',
    filterUpcoming: 'Upcoming',
    filterTop5: 'Top Leagues',

    // Filter Modal
    filterTitle: 'Filter Leagues',
    filterSave: 'Save',
    filterClearAll: 'Clear All',
    filterMajorLeagues: 'Major Leagues',
    filterSearchPlaceholder: 'Search for a league...',
    filterSelectedCount: '{count} leagues selected',
    filterNoSelection: 'No leagues selected (all matches will be shown)',

    // Empty States
    emptyTitle: 'No Matches',
    emptySubtitle: 'No matches available at the moment',
    emptySearch: 'No matches found matching your search',
    emptyPredictions: 'No upcoming matches available for prediction today',
    allLeagues: 'All Leagues',
    searchLeagues: 'Search leagues...',
  },

  search: {
    all: 'All',
    players: 'Players',
    teams: 'Teams',
    leagues: 'Leagues',
    matches: 'Matches',
    noResults: 'No results found',
    searching: 'Searching...',
    recentPlayers: 'Recently Viewed Players',
    placeholder: 'Search for players, teams or leagues...',
    searchForTeam: 'Search for a team to see their matches',
  },
  teamProfile: {
    stadium: 'Stadium',
    capacity: 'capacity',
    squadList: 'Squad List',
    noSquadData: 'No squad data available',
  },

  filters: {
    // Header & Actions
    title: 'Filter Matches',
    apply: 'Apply Filter',
    reset: 'Reset',

    // Section Titles
    matchStatus: 'Match Status',
    time: 'Time',
    league: 'League',
    country: 'Country',
    continent: 'Continent',

    // Common
    all: 'All',

    // Continents
    europe: 'Europe',
    africa: 'Africa',
    asia: 'Asia',
    southAmerica: 'South America',

    // Countries
    england: 'England',
    spain: 'Spain',
    germany: 'Germany',
    italy: 'Italy',
    france: 'France',
    egypt: 'Egypt',
    saudi: 'Saudi Arabia',

    // Leagues
    premierLeague: 'Premier League',
    laLiga: 'La Liga',
    bundesliga: 'Bundesliga',
    serieA: 'Serie A',
    ligue1: 'Ligue 1',
    championsLeague: 'Champions League',

    // Match Status
    live: 'Live',
    upcoming: 'Upcoming',
    finished: 'Finished',

    // Times
    allDay: 'All Day',
    morning: 'Morning',
    afternoon: 'Afternoon',
    evening: 'Evening',
  },

  notificationCancelled: 'You will not receive notifications about this match',


  matchDetails: {
    title: 'Match Details',
    vs: 'VS',

    // Match Status
    statusLive: 'Live',
    statusFinished: 'Finished',
    statusUpcoming: 'Upcoming',

    // Tabs
    lineups: 'Lineups',
    statistics: 'Statistics',
    events: 'Events',
    form: 'Previous Results',
    startingXI: 'Starting XI',
    substitutes: 'Substitutes',
    coach: 'Coach',
    formation: 'Formation',
    noLineups: 'Lineups not available',
    noStats: 'Statistics not available',
    noEvents: 'No events available',
    beforeMatch: 'Data may not be available before match starts',
    matchEvents: 'Match Events',
    last5Matches: 'Last 5 Matches',
    noPreviousMatches: 'No previous matches',
    goalkeeper: 'Goalkeeper',
    defender: 'Defender',
    midfielder: 'Midfielder',
    forward: 'Forward',
    goal: 'Goal',
    penaltyGoal: 'Penalty Goal',
    ownGoal: 'Own Goal',
    yellowCard: 'Yellow Card',
    redCard: 'Red Card',
    substitution: 'Substitution',
    assist: 'Assist',

    // Stats
    shots: 'Shots',
    shotsOnGoal: 'Shots on Goal',
    possession: 'Possession',
    passes: 'Passes',
    fouls: 'Fouls',
    yellowCards: 'Yellow Cards',
    redCards: 'Red Cards',
    offsides: 'Offsides',
    corners: 'Corners',
    standings: 'Standings',
    team: 'Team',
  },

  predictions: {
    title: 'Predictions',
    makePrediction: 'Make Prediction',
    canPredictOnly: 'You can only predict on upcoming matches. Choose the result and expected goals!',
    noPredictableMatches: 'No upcoming matches available for prediction today. Try later!',

    // Match Card
    predict: 'Predict',
    yourPrediction: 'Your Prediction:',
    homeWin: 'Win',
    awayWin: 'Win',
    draw: 'Draw',

    // Modal
    choosePrediction: 'Choose Your Prediction',
    submitPrediction: 'Submit Prediction',
    submitting: 'Submitting...',

    // Alerts
    alertTitle: 'Alert',
    cannotPredictLive: 'You can only predict on upcoming matches',
    successTitle: 'Done!',
    successMessage: 'Your prediction has been saved successfully',
    errorTitle: 'Error',
    errorMessage: 'An error occurred while saving your prediction',

    // Results
    correctPrediction: 'Correct Prediction!',
    wrongPrediction: 'Wrong Prediction',

    // Notifications
    notificationsEnabled: 'Notifications Enabled',
    notificationsDisabled: 'Notifications Disabled',
    notificationMessage: 'You will receive notifications about:\n• Match start\n• Goals\n• Final result',
    notificationCancelled: 'You will not receive notifications about this match',
  },

  quiz: {
    congratulations: 'Congratulations!',
    quizCompleted: 'You have successfully completed the quiz',
    points: 'Points',
    accuracy: 'Accuracy',
    correct: 'Correct',
    bestStreak: 'Best Streak',
    goldCoins: 'Gold Coins',
    playAgain: 'Play Again',
    excellent: 'Excellent!',
    wrong: 'Wrong!',
    gamePaused: 'Game Paused',
    pressToResume: 'Press to Resume',
    continue: 'Continue',
    consecutiveAnswers: 'consecutive answers!',
  },

  // Lucky Wheel
  luckyWheel: {
    title: 'Daily Lucky Wheel',
    spinning: 'Spinning...',
    spin: 'SPIN',
    youWon: 'You Won!',
    coins: 'Coins',
    congratulations: 'Congratulations!',
    tryAgainTomorrow: 'Try again tomorrow',
    availableIn: 'Available in',
    hours: 'hours',
    minutes: 'minutes',
  },

  // Notifications Screen
  notifications: {
    title: 'Notifications',
    loading: 'Loading notifications...',
    clearAll: 'Clear All',
    noNotifications: 'No notifications yet',
    noNotificationsSubtitle: 'Follow, like, and comment notifications will appear here',
    luckyWheelReady: '🎡 Lucky Wheel Ready!',
    tapToWin: 'Tap here to win free coins',
    wheelAvailableIn: 'Lucky wheel available in',
    newNotification: 'new',
    now: 'Now',
    minutesAgo: '{n} minutes ago',
    hoursAgo: '{n} hours ago',
    daysAgo: '{n} days ago',
  },

  // Security Settings
  security: {
    title: 'Advanced Security',
    pinCode: 'PIN Code',
    pinEnabled: 'Enabled',
    pinDisabled: 'Disabled',
    biometric: 'Fingerprint / Face ID',
    biometricEnabled: 'Enabled',
    biometricDisabled: 'Disabled',
    autoLock: 'Auto Lock',
    afterMinutes: 'After {n} minutes',
    setupPin: 'Setup PIN',
    newPin: 'New PIN',
    confirmPin: 'Confirm PIN',
    enterDigits: 'Enter 4 digits',
    pinMismatch: 'PIN codes do not match',
    pinTooShort: 'PIN must be at least 4 digits',
    biometricUnavailable: 'Fingerprint or Face ID not available on this device',
    confirmIdentity: 'Confirm Identity',
    usePasscode: 'Use Passcode',
    immediate: 'Immediate',
    oneMinute: '1 minute',
    fiveMinutes: '5 minutes',
    fifteenMinutes: '15 minutes',
    never: 'Never',
  },

  // Username Setup
  usernameSetup: {
    title: 'Choose Username',
    subtitle: 'Pick a unique username for your profile',
    placeholder: 'Enter username',
    requirements: 'Letters, numbers, and underscores only',
    minLength: 'Username must be at least 3 characters',
    maxLength: 'Username must be less than 20 characters',
    invalidChars: 'Username can only contain letters, numbers, and underscores',
    taken: 'Username might be taken. Try another one.',
    authFailed: 'Authentication failed',
    setFailed: 'Failed to set username. Please try again.',
    skip: 'Skip',
    continue: 'Continue',
  },

  // About Us
  aboutUs: {
    title: 'About Us',
    description: 'User profile will be displayed here',
  },

  // Not Found
  notFound: {
    title: 'Oops!',
    description: "This screen doesn't exist.",
    goHome: 'Go to home screen',
  },

  // Push Notifications Content
  pushNotifications: {
    matchStarting: '⚽ Match is about to start!',
    matchStartingBody: '{home} vs {away} - in {minutes} minutes',
    goal: '⚽ Goal!',
    goalBody: '{player} scores for {team} in minute {minute}',
    predictionCorrect: '🎉 Correct Prediction!',
    predictionCorrectBody: 'You won {points} points in {match}',
    predictionWrong: '😔 Wrong Prediction',
    predictionWrongBody: 'Unfortunately, your prediction in {match} was incorrect',
  },

  home: {
    welcome: 'Welcome',
    welcomeBack: 'Welcome Back',
    guest: 'Guest',
    register: 'Register Now',
    createCard: 'Create Card',
    videos: 'Videos',
    players: 'Players',
    team: 'Team',
    viewAll: 'View All',
    predict: 'Predict',
    quiz: 'Daily Quiz',
    reels: 'Reels',
    rank: 'Leaderboard',
    days: 'Days',
    streak: 'Daily Streak',
    nextLevel: 'Next Level',
    // New keys for Home screen components
    nextGenFantasy: 'NEXT GEN FANTASY',
    unlock: 'UNLOCK',
    potential: 'POTENTIAL',
    tagline: 'Compete. Predict. Rise.',
    getStarted: 'GET STARTED',
    signIn: 'SIGN IN',
    importantMatches: 'Important Matches',
    trendingReels: 'Trending Reels',
    playerOfWeek: 'Player of the Week',
    teamOfMonth: 'Team of the Month',
    // WelcomeSection slides
    hello: 'Hello',
    consecutiveDays: 'consecutive days - keep going!',
    newChallenges: 'Your day is full of new challenges',
    profile: 'Profile',
    luckyWheel: 'Lucky Wheel',
    wheelLocked: 'Wheel Locked',
    spinAndWin: 'Spin and win daily prizes!',
    availableAfter: 'Available after',
    tryYourLuck: 'Try Your Luck',
    predictions: 'Predictions',
    matchesAvailable: 'matches available to predict',
    predictResults: 'Predict match results',
    predictNow: 'Predict Now',
    knowledgeChallenge: 'Knowledge Challenge',
    testKnowledge: 'Test your football knowledge',
    startQuiz: 'Start Quiz',
    rankPosition: 'Rank',
    ranking: 'Ranking',
    competeWithBest: 'Compete with the best players',
    seeYourRank: 'See Your Rank',
    joinCompetition: 'Join the Competition!',
    registerAndStart: 'Register now and start your football journey',
    startNow: 'Start Now',
    day: 'day',
  },

  rank: {
    title: 'Rankings',
    rankings: 'Rankings',
    playerRating: 'Player Rating',
    topViewers: 'Top Viewers',
    topComments: 'Top Comments',
    topShares: 'Top Shares',
    quizMasters: 'Quiz Masters',
    goals: 'Goals',
    assists: 'Assists',
    yellow: 'Yellow',
    matches: 'Matches',
    approval: 'Approval',
    predictions: 'Predictions',
    following: 'Following',
    follow: 'Follow',
    // Empty state messages
    firstPlace: '1st Place',
    secondPlace: '2nd Place',
    thirdPlace: '3rd Place',
    waitingForYou: 'Waiting for you!',
    beTheBest: 'Be the best',
    competeNow: 'Compete now',
  },

  profile: {
    title: 'Profile',
    myProfile: 'My Profile',
    editProfile: 'Edit Profile',
    shareProfile: 'Share Profile',
    viewQR: 'View QR Code',
    settings: 'Settings',
    notifications: 'Notifications',

    // Stats
    level: 'Level',
    rank: 'Rank',
    followers: 'Followers',
    following: 'Following',
    totalPredictions: 'Total Predictions',
    accuracy: 'Accuracy',
    quizScore: 'Quiz Score',
    achievements: 'Achievements',
    videos: 'Videos',

    // Tabs
    profiles: 'Profiles',
    myVideos: 'My Videos',
    myAchievements: 'My Achievements',
    interactions: 'Interactions',
    activity: 'Activity',

    // Actions
    edit: 'Edit',
    share: 'Share',
    message: 'Message',
    block: 'Block',
    report: 'Report',
    uploadVideo: 'Upload Video',
    createContent: 'Create content',

    // Social
    followersCount: 'Followers',
    followingCount: 'Following',
    friendRequests: 'Friend Requests',
    recentActivity: 'Recent Activity',

    // Empty States
    noVideos: 'No videos yet',
    noAchievements: 'No achievements yet',
    noActivity: 'No activity yet',

    // Loading
    loadingProfile: 'Loading profile...',
    loadingVideos: 'Loading videos...',

    // Messages
    profileUpdated: 'Profile updated',
    profileShared: 'Profile shared',
    errorLoading: 'Failed to load data',

    // Analytics
    videoAnalytics: 'Video Analytics',
    views: 'Views',
    likes: 'Likes',
    comments: 'Comments',
    newFollowers: 'New Followers (7 days)',
    performanceSummary: 'Performance Summary',
    totalVideos: 'Total Videos',
    profileVisits: 'Profile Visits',
    avgEngagement: 'Average Engagement',
    predictionStats: 'Prediction Statistics',
    correctPredictions: 'Correct Predictions',
    wrongPredictions: 'Wrong Predictions',
    pendingPredictions: 'Pending',
    successRate: 'Success Rate',
    coinsEarned: 'Coins Earned from Predictions',
    achievementsTitle: 'Achievements',
    firstPrediction: 'First Prediction',
    tenPredictions: '10 Predictions',
    firstCorrect: 'First Correct',
    fiveCorrect: '5 Correct',
    fiftyAccuracy: '50% Accuracy',
    professional: 'Professional',
    coinsStats: 'Coins Statistics',
    coinsFromPredictions: 'Coins earned from correct predictions',
    coinsSpent: 'Coins spent on predictions',
    netProfit: 'Net Profit/Loss',
    predictionCost: 'Prediction = 5 coins • Win = +10 coins',
    chooseClub: 'Choose your club',

    // QR Code Modal
    qrCode: 'QR Code',
    scanToFollow: 'Scan to follow this profile',
    checkMyProfile: 'Check out my profile on 90Plus!',

    // Social Links
    addSocialLinks: 'Add your social media links',

    // Block & Report
    blockUser: 'Block User',
    blockConfirm: 'Are you sure you want to block',
    blockDesc: 'They won\'t be able to see your profile or contact you',
    userBlocked: 'User has been blocked',
    reportUser: 'Report User',
    reportDesc: 'Report inappropriate behavior or content',
    reportWarning: 'False reports may result in action against your account',
    selectReason: 'Select a reason',
    additionalInfo: 'Additional details (optional)',
    sendReport: 'Send Report',
    reportSent: 'Report sent successfully. We will review it soon.',
  },

  settings: {
    title: 'Settings',
    subtitle: 'Customize your experience',
    notifications: 'Notifications',
    preferences: 'Preferences',
    dataStorage: 'Data & Storage',
    about: 'About',
    account: 'Account',
    enableNotifications: 'Enable Notifications',
    enableNotificationsDesc: 'Receive all notifications',
    matchNotifications: 'Match Notifications',
    matchNotificationsDesc: 'Alerts before important matches start',
    goalNotifications: 'Goal Notifications',
    goalNotificationsDesc: 'Instant alerts when goals are scored',
    predictionReminders: 'Prediction Reminders',
    predictionRemindersDesc: 'Remind you to predict before match starts',
    favoriteTeams: 'Favorite Teams',
    favoriteTeamsDesc: 'Choose your favorite teams to follow',
    favoriteLeagues: 'Favorite Leagues',
    favoriteLeaguesDesc: 'Select leagues you want to follow',
    language: 'Language',
    clearCache: 'Clear Cache',
    clearCacheDesc: 'Free up storage space',
    cacheSize: 'Stored Data Size',
    lastSync: 'Last Sync',
    version: 'Version',
    rateApp: 'Rate App',
    rateAppDesc: 'Help us with your rating',
    shareApp: 'Share App',
    shareAppDesc: 'Share with friends',
    contactUs: 'Contact Us',
    privacyPolicy: 'Privacy Policy',
    privacyPolicyDesc: 'View privacy policy',
    termsConditions: 'Terms & Conditions',
    termsConditionsDesc: 'Read terms of use',
    logout: 'Logout',
    logoutDesc: 'Sign out of your account',
    deleteAccount: 'Delete Account',
    deleteAccountDesc: 'Permanently delete your account and all data',
    clearCacheTitle: 'Clear Cache',
    clearCacheMessage: 'Are you sure you want to clear all cached data?',
    clearCacheSuccess: 'Cache cleared successfully',
    clearCacheError: 'Failed to clear cache',
    madeWith: 'Made with ❤️ for football fans',
    copyright: '© 2024 Football Predictions. All rights reserved.',
    comingSoon: 'Coming Soon',
    featureInDevelopment: 'This feature is under development',

    // Appearance
    appearance: 'Appearance',
    theme: 'Theme',
    amoled: 'AMOLED Dark',
    dark: 'Dark',
    light: 'Light',
    soundEffects: 'Sound Effects',
    soundEffectsDesc: 'Play sounds in app',
    hapticFeedback: 'Haptic Feedback',
    hapticFeedbackDesc: 'Enable haptic feedback on interaction',
    biometricUnlock: 'Biometric Unlock',
    biometricUnlockDesc: 'Use biometrics to login',

    // Permissions
    permissions: 'Permissions',
    managePermissions: 'Manage Permissions',
    managePermissionsDesc: 'Control app permissions',
    enabled: 'Enabled',
    disabled: 'Disabled',

    // Data
    autoRefresh: 'Auto Refresh',
    autoRefreshDesc: 'Automatically refresh data',
    exportData: 'Export Data',
    exportDataDesc: 'Export all your data',

    // Help
    helpSupport: 'Help & Support',
    helpCenter: 'Help Center',
    helpCenterDesc: 'FAQ and user guide',
    reportBug: 'Report a Bug',
    reportBugDesc: 'Tell us about technical issues',
    featureRequest: 'Feature Request',
    featureRequestDesc: 'Share your ideas to improve the app',

    // Advanced
    advanced: 'Advanced',
    resetSettings: 'Reset Settings',
    resetSettingsDesc: 'Restore default settings',
    ipAddress: 'IP Address',

    // Alerts/Modals
    languageDatabases: 'Language Changed',
    languageChangedMessage: 'Language changed successfully. You may need to restart the app for full effect.',
    changeLanguageError: 'Failed to change language',
    confirmDelete: 'Confirm Deletion',
    areYouSureDelete: 'Are you sure?',
    yesDelete: 'Yes, Delete',
    warning: 'Warning',
    actionUndone: 'This action cannot be undone.',
    resetConfirm: 'Are you sure you want to reset all settings to default?',
    resetSuccess: 'Settings reset successfully',
    resetError: 'Failed to reset settings',
    exportDisclaimer: 'All your data and predictions will be exported',
    exportBtn: 'Export',
    helpPrompt: 'How can we help you?',
    faq: 'FAQ',
    userGuide: 'User Guide',
    justNow: 'Just now',
    minutesAgo: '{n} minutes ago',
    hoursAgo: '{n} hours ago',
  },

  reels: {
    // Actions
    like: 'Like',
    comment: 'Comment',
    share: 'Share',
    save: 'Save',
    follow: 'Follow',
    following: 'Following',

    // States
    views: 'Views',
    likes: 'Likes',
    comments: 'Comments',
    shares: 'Shares',

    // Comments
    addComment: 'Add a comment...',
    commentPlaceholder: 'Write a comment...',
    sendComment: 'Send',
    viewComments: 'View Comments',
    noComments: 'No comments yet',

    // Share Menu
    shareVideo: 'Share Video',
    copyLink: 'Copy Link',
    shareToWhatsApp: 'Share to WhatsApp',
    shareToFacebook: 'Share to Facebook',
    shareToTwitter: 'Share to Twitter',
    downloadVideo: 'Download Video',
    reportVideo: 'Report Video',

    // Loading
    loading: 'Loading...',
    loadingMore: 'Loading more...',

    // Empty States
    noVideos: 'No videos available',
    noVideosTitle: 'No Videos Yet',
    noVideosSubtitle: 'Follow people to see their videos here',
    noVideosCallToAction: 'Discover People',
    noMoreVideos: 'No more videos',
    endOfFeed: "You've seen all videos 🎉",

    // Swipe Hint
    swipeUp: 'Swipe up for more',

    // Report
    reportTitle: 'Report Content',
    reportSubtitle: 'Help us understand the issue',
    reportSuccessTitle: 'Report Submitted',
    reportSuccessMessage: 'Thanks for helping keep our community safe',
    submitReport: 'Submit Report',
    cancelReport: 'Cancel',
    otherReason: 'Other',
    writeReason: 'Write a reason...',
    reasons: {
      inappropriate: 'Inappropriate content',
      spam: 'Spam or misleading',
      hateSpeech: 'Hate speech',
      violence: 'Violence or harm',
      copyright: 'Copyright violation',
      adult: 'Adult content',
      misinfo: 'False information',
      other: 'Other',
    },

    // Toasts
    saved: 'Saved',
    unsaved: 'Unsaved',

    // Errors
    loadFailed: 'Failed to load video',
    retry: 'Retry',
    buffering: 'Buffering...',
    tapToReplay: 'Tap to replay',
    replayVideo: 'Replay video',
    loadingVideos: 'Loading videos...',
  },
};

export default en;
