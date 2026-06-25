import styled, { css } from "styled-components";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "ghost" | "danger" | "warn";
type ButtonSize = "sm" | "md";

const variantStyles = {
  primary: css`
    background: linear-gradient(135deg, #4f78ff, #7c5cff);
    box-shadow: 0 8px 18px rgb(79 120 255 / 20%);
    color: #fff;

    &:hover:not(:disabled) {
      filter: brightness(1.1);
    }
  `,
  ghost: css`
    background: #121c2b;
    border: 1px solid var(--border);
    color: var(--text);

    &:hover:not(:disabled) {
      border-color: var(--accent);
      color: var(--accent);
    }
  `,
  danger: css`
    background: var(--danger);
    color: #fff;

    &:hover:not(:disabled) {
      filter: brightness(1.1);
    }
  `,
  warn: css`
    background: rgb(244 165 38 / 14%);
    border: 1px solid rgb(244 165 38 / 30%);
    color: var(--warn);
  `,
};

const StyledButton = styled.button<{ $variant: ButtonVariant; $size: ButtonSize }>`
  align-items: center;
  border: 0;
  border-radius: 8px;
  cursor: pointer;
  display: inline-flex;
  font-size: 0.86rem;
  font-weight: 600;
  gap: 6px;
  justify-content: center;
  min-height: ${({ $size }) => ($size === "sm" ? "34px" : "40px")};
  padding: ${({ $size }) => ($size === "sm" ? "6px 11px" : "9px 17px")};
  transition: border-color 0.15s, color 0.15s, filter 0.15s, opacity 0.15s;
  white-space: nowrap;

  &:disabled {
    cursor: not-allowed;
    opacity: 0.58;
  }

  ${({ $variant }) => variantStyles[$variant]}
`;

interface ActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  size?: ButtonSize;
  variant?: ButtonVariant;
}

export default function ActionButton({
  children,
  size = "md",
  variant = "ghost",
  ...props
}: ActionButtonProps) {
  return (
    <StyledButton $size={size} $variant={variant} {...props}>
      {children}
    </StyledButton>
  );
}
