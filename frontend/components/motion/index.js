"use client"

import { motion, useReducedMotion } from "framer-motion"

export function MotionWrapper({ children, delay = 0, className = "" }) {
  const reduceMotion = useReducedMotion()

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      whileInView={reduceMotion ? {} : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1], delay }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

export function AnimatedCard({ children, className = "", delay = 0, style = {} }) {
  const reduceMotion = useReducedMotion()

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 20 }}
      whileInView={reduceMotion ? {} : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay }}
      whileHover={reduceMotion ? undefined : { y: -6 }}
      className={className}
      style={style}
    >
      {children}
    </motion.div>
  )
}

export function AnimatedButton({ children, className = "", ...props }) {
  const reduceMotion = useReducedMotion()

  return (
    <motion.div
      role="button"
      whileHover={reduceMotion ? undefined : { scale: 1.02 }}
      whileTap={reduceMotion ? undefined : { scale: 0.98 }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  )
}
