#!/bin/bash
RELEASE_CHANNEL=stable

package_artifacts() {
  echo "packaging"
}

function publish_release {
  echo "publishing to $RELEASE_CHANNEL"
}

package_artifacts
publish_release
