import { useState, useRef, useEffect } from 'react';
import { saveCustomerOverride } from '../lib/coda-client';

interface EditableNameProps {
  tenantId: string;
  displayName: string;
  onSave?: (newName: string) => void;
}

export function EditableName({ tenantId, displayName, onSave }: EditableNameProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(displayName);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsEditing(true);
    setEditValue(displayName);
  };

  const handleSave = async () => {
    if (editValue.trim() === displayName) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      await saveCustomerOverride({
        tenantId,
        displayName: editValue.trim(),
      });
      onSave?.(editValue.trim());
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to save name:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setEditValue(displayName);
    }
  };

  const handleBlur = () => {
    handleSave();
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        className="editable-name-input"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        disabled={isSaving}
        onClick={(e) => e.stopPropagation()}
      />
    );
  }

  return (
    <span 
      className="editable-name"
      onDoubleClick={handleDoubleClick}
      title="Double-click to edit"
    >
      {displayName}
      <span className="edit-hint">✏️</span>
    </span>
  );
}
