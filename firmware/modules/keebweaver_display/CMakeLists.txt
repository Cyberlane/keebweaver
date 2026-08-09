if(CONFIG_KEEBWEAVER_DISPLAY_ART)
  # Custom ZMK screens are linked into the app target. This deliberately
  # replaces the stock nice!view widget rather than patching its sources.
  target_include_directories(app PRIVATE ${CMAKE_SOURCE_DIR}/include)
  target_sources(app PRIVATE ${CMAKE_CURRENT_LIST_DIR}/src/display_art.c)
endif()
