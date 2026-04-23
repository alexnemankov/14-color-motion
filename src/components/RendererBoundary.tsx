import React from 'react';
import { RendererStatus } from '../types';

interface RendererBoundaryProps {
  children: React.ReactNode;
  onError: (status: RendererStatus) => void;
  resetKey: string;
}

interface RendererBoundaryState {
  hasError: boolean;
}

export default class RendererBoundary extends React.Component<RendererBoundaryProps, RendererBoundaryState> {
  state: RendererBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch() {
    this.props.onError({
      title: 'Renderer crashed',
      message: 'This visual mode hit an unexpected error. Switch modes or reload the page if the problem persists.',
    });
  }

  componentDidUpdate(prevProps: RendererBoundaryProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) {
      return null;
    }

    return this.props.children;
  }
}
