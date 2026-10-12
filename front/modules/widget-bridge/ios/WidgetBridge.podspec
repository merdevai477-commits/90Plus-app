Pod::Spec.new do |s|
  s.name           = 'WidgetBridge'
  s.version        = '1.0.0'
  s.summary        = '90PLUS home-screen widget config + match Live Activities'
  s.description    = s.summary
  s.license        = 'UNLICENSED'
  s.author         = '90PLUS'
  s.homepage       = 'https://90plus.pro'
  s.platforms      = { :ios => '16.0' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = '**/*.swift'
end
