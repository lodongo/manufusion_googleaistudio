
import React from 'react';

// Base props for all variants
interface BaseProps {
  label: string;
  id: string;
  error?: string;
  containerClassName?: string;
}

// Props for when the component is an <input>
interface AsInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  as?: 'input';
  rightIcon?: React.ReactNode;
}

// Props for when the component is a <textarea>
interface AsTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  as: 'textarea';
}

// Props for when the component is a <select>
interface AsSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  as: 'select';
  children: React.ReactNode;
}

// Union of all possible props
type InputProps = BaseProps & (AsInputProps | AsTextareaProps | AsSelectProps);

const Input: React.FC<InputProps> = ({ label, id, error, containerClassName, ...props }) => {
  const errorClasses = error
    ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
    : 'border-slate-300 focus:ring-indigo-500 focus:border-indigo-500';

  const renderElement = () => {
    // Using props.as for type guarding allows TypeScript to correctly narrow the type of the `props` discriminated union.
    if (props.as === 'select') {
      const { as: _as, children, ...rest } = props;
      return (
        <select
          id={id}
          {...rest}
          className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-1 transition-colors duration-200 bg-white ${errorClasses}`}
        >
          {children}
        </select>
      );
    } else if (props.as === 'textarea') {
      const { as: _as, ...rest } = props;
      return (
        <textarea
          id={id}
          {...rest}
          className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-1 transition-colors duration-200 bg-white ${errorClasses}`}
        />
      );
    } else {
      // Default to 'input'. Here `props` is correctly inferred to be AsInputProps.
      const { as: _as, rightIcon, ...rest } = props;
      return (
        <div className="mt-1 relative">
          <input
            id={id}
            {...rest}
            className={`w-full px-3 py-2 border rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-1 transition-colors duration-200 bg-white ${errorClasses} ${rightIcon ? 'pr-10' : ''}`}
          />
          {rightIcon && (
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
              {rightIcon}
            </div>
          )}
        </div>
      );
    }
  };

  return (
    <div className={containerClassName}>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}
        {props.required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {renderElement()}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
};

export default Input;