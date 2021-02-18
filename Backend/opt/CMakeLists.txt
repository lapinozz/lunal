include(FetchContent) 

set(JSON_INCLUDE_DIRS ${CMAKE_CURRENT_SOURCE_DIR}/json/src PARENT_SCOPE)

if(WIN32)
    option(CMAKE_USE_OPENSSL "Use OpenSSL code. Experimental" OFF)
endif()

set(BOOST_REQUESTED_VERSION 1.73.0)
set(BOOST_COMPONENTS system thread filesystem coroutine context)
include("GetBoost.cmake")

add_subdirectory(cpr)
add_subdirectory(swss)
