---
name: ChatGPT Chat Layout
overview: Rebuild the chat screen as a flex-column layout (SafeAreaView → fixed header → flex:1 messages → fixed composer) and remove conflicting keyboard lifts that cause blank space. Extract a ChatComposer component and harden MessageBubble width/RTL/table behavior.
todos:
  - id: layout-shell
    content: "Rebuild chat.tsx: SafeAreaView, in-flow header, iOS-only KAV, flex column (list + composer)"
    status: completed
  - id: keyboard-cleanup
    content: Remove keyboardHeight layout padding, Android KAV height, FlatList automaticallyAdjustKeyboardInsets
    status: completed
  - id: chat-composer
    content: Create ChatComposer.tsx with onLayout height, safe-area bottom, multiline pill + SendButton
    status: completed
  - id: flatlist-padding
    content: Wire composerHeight to FlatList contentContainerStyle and FAB bottom offsets
    status: completed
  - id: message-bubble
    content: "MessageBubble: dynamic widths, flexShrink, Arabic/RTL, responsive table ScrollView block"
    status: completed
  - id: manual-qa
    content: Manual QA on Android resize + iOS keyboard open/close + table/long-text cases
    status: completed
isProject: false
---

يعد ما تخلص قولي اي الي تم 

