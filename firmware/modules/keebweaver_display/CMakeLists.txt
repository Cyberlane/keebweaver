if(CONFIG_KEEBWEAVER_DISPLAY_ART)
  # Custom ZMK screens are linked into the app target. This deliberately
  # replaces the stock nice!view widget rather than patching its sources.
  target_sources(app PRIVATE ${CMAKE_CURRENT_LIST_DIR}/src/display_art.c)
endif()

if(CONFIG_KEEBWEAVER_DISPLAY_ART OR CONFIG_KEEBWEAVER_POINTER_SPEED OR CONFIG_KEEBWEAVER_LAYER_STATE_BLE)
  target_include_directories(app PRIVATE ${CMAKE_CURRENT_LIST_DIR}/include)
endif()

if(CONFIG_KEEBWEAVER_POINTER_SPEED)
  target_sources(app PRIVATE
    ${CMAKE_CURRENT_LIST_DIR}/src/pointer_speed.c
    ${CMAKE_CURRENT_LIST_DIR}/src/behavior_pointer_speed.c
  )
endif()

if(CONFIG_KEEBWEAVER_LAYER_STATE_BLE)
  target_sources(app PRIVATE ${CMAKE_CURRENT_LIST_DIR}/src/layer_state_ble.c)
endif()
