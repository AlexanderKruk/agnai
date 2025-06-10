/**
 * Shared Avatar Components
 * 
 * This module provides reusable avatar components for use across
 * the application, including avatar building, display, and management.
 */

// Avatar building and editing
export { default as AvatarBuilder } from './Builder'
export { default as AvatarContainer } from './Container'
export { default as AvatarCanvas } from './Canvas'

// Avatar display components
export { AvatarModal } from './AvatarModal'

// Avatar utilities and hooks
export * from './hooks'