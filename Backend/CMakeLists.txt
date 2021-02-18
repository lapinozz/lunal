cmake_minimum_required(VERSION 3.15)
project(lunal)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

set(BUILD_CPR_TESTS FALSE)
add_subdirectory(opt)

set(SRC_ROOT ${PROJECT_SOURCE_DIR}/src)

file(GLOB SRC_FILES ${SRC_ROOT}/*.cpp)
add_executable(lunal ${SRC_FILES})

set_target_properties(
    lunal PROPERTIES
    VS_DEBUGGER_WORKING_DIRECTORY "${CMAKE_SOURCE_DIR}/bin")

target_link_libraries(lunal ${CPR_LIBRARIES} simple-websocket-server)
include_directories(${CPR_INCLUDE_DIRS} ${JSON_INCLUDE_DIRS} ${SRC_ROOT})
