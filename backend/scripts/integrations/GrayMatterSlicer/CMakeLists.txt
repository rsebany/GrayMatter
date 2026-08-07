cmake_minimum_required(VERSION 3.16.3...3.19.7 FATAL_ERROR)

project(GrayMatterSlicer)

set(EXTENSION_HOMEPAGE "https://github.com/shifttech/GrayMatter")
set(EXTENSION_CATEGORY "Informatics")
set(EXTENSION_CONTRIBUTORS "GrayMatter contributors")
set(EXTENSION_DESCRIPTION "Pull, edit, validate, and push GrayMatter hippocampus segmentations from 3D Slicer.")
set(EXTENSION_ICONURL "")
set(EXTENSION_SCREENSHOTURLS "")
set(EXTENSION_DEPENDS "NA")

find_package(Slicer REQUIRED)
include(${Slicer_USE_FILE})

add_subdirectory(GrayMatterSlicer)

include(${Slicer_EXTENSION_GENERATE_CONFIG})
include(${Slicer_EXTENSION_CPACK})
