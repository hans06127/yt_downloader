import styled, { css } from "styled-components";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "success" | "danger" | "warn";
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
  secondary: css`
    background: rgb(34 211 238 / 12%);
    border: 1px solid rgb(34 211 238 / 30%);
    color: #67e8f9;

    &:hover:not(:disabled) {
      background: rgb(34 211 238 / 18%);
      border-color: rgb(34 211 238 / 48%);
      color: #a5f3fc;
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
  success: css`
    background: rgb(53 208 127 / 16%);
    border: 1px solid rgb(53 208 127 / 34%);
    color: var(--success);

    &:hover:not(:disabled) {
      background: rgb(53 208 127 / 22%);
      border-color: rgb(53 208 127 / 52%);
      color: #89f5b9;
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
  variant = "secondary",
  ...props
}: ActionButtonProps) {
  return (
    <StyledButton $size={size} $variant={variant} {...props}>
      {children}
    </StyledButton>
  );
}
