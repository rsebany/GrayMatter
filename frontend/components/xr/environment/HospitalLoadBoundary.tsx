"use client";

import React, { Component } from "react";

type BoundaryProps = {
  children: React.ReactNode;
  onFailed?: () => void;
};

type BoundaryState = { failed: boolean };

export class HospitalLoadBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { failed: false };

  static getDerivedStateFromError(): BoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.warn("Hospital environment failed to load; using dark fallback room.", error);
    this.props.onFailed?.();
  }

  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}
