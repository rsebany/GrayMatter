import React, { Component } from "react";

type BrainMeshErrorBoundaryProps = {
  fallback: React.ReactNode;
  onError?: (e: Error) => void;
  children: React.ReactNode;
};

type BrainMeshErrorBoundaryState = {
  hasError: boolean;
  error?: Error;
};

export class BrainMeshErrorBoundary extends Component<
  BrainMeshErrorBoundaryProps,
  BrainMeshErrorBoundaryState
> {
  state: BrainMeshErrorBoundaryState = { hasError: false, error: undefined };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    this.props.onError?.(error);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}
