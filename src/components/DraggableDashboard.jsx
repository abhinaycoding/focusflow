import React, { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import TaskPlanner from './TaskPlanner';
import NotesPreview from './NotesPreview';
import FocusTimer from './FocusTimer';
import AnalyticsCards from './AnalyticsCards';

const WIDGETS = {
  'timer': { id: 'timer', title: 'Chronos', component: FocusTimer },
  'metrics': { id: 'metrics', title: 'Metrics', component: AnalyticsCards },
  'ledger': { id: 'ledger', title: 'The Ledger', component: TaskPlanner },
  'archives': { id: 'archives', title: 'Archives' /* Component receives props below */ }
};

const DEFAULT_ORDER = ['timer', 'metrics', 'ledger', 'archives'];

const DashboardWidget = ({ id, title, children, isEditing, index }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id, disabled: !isEditing });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 100 : 'auto',
    position: isDragging ? 'relative' : 'static',
    animationDelay: `${index * 0.15}s`
  };

  return (
    <section ref={setNodeRef} style={style} className={`dash-section dashboard-widget widget-reveal ${isEditing ? 'is-editing' : ''}`}>
      <div className="flex justify-between items-center mb-4 px-4">
        <h2 className="text-xl font-serif text-muted italic">{title}</h2>
        {isEditing && (
          <div 
            {...attributes} 
            {...listeners} 
            className="cursor-move p-2 text-muted hover:text-primary transition-colors flex items-center justify-center bg-cream/50 rounded-full border border-ink"
            style={{ touchAction: 'none' }}
            title="Drag to reorder"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="5" r="1"></circle><circle cx="9" cy="12" r="1"></circle><circle cx="9" cy="19" r="1"></circle>
              <circle cx="15" cy="5" r="1"></circle><circle cx="15" cy="12" r="1"></circle><circle cx="15" cy="19" r="1"></circle>
            </svg>
          </div>
        )}
      </div>
      <div className={isEditing ? 'pointer-events-none opacity-50' : ''}>
        {children}
      </div>
    </section>
  );
};

const DraggableDashboard = ({ onNavigate, isEditing }) => {
  const [items, setItems] = useState(() => {
    const saved = localStorage.getItem('ff_widget_order');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Verify all expected widgets exist in saved order (handles code updates)
        if (parsed.length === DEFAULT_ORDER.length && parsed.every(p => DEFAULT_ORDER.includes(p))) {
          return parsed;
        }
      } catch { console.error('Error parsing widget order'); }
    }
    return DEFAULT_ORDER;
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px movement before dragging starts (prevents click capture)
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setItems((items) => {
        const oldIndex = items.indexOf(active.id);
        const newIndex = items.indexOf(over.id);
        const newOrder = arrayMove(items, oldIndex, newIndex);
        localStorage.setItem('ff_widget_order', JSON.stringify(newOrder));
        return newOrder;
      });
    }
  };

  return (
    <DndContext 
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <div className="dash-grid">
        <SortableContext 
          items={items}
          strategy={rectSortingStrategy}
        >
          {items.map((id, index) => {
            const widget = WIDGETS[id];
            if (!widget) return null;
            
            return (
              <DashboardWidget 
                key={id} 
                id={id} 
                title={widget.title}
                isEditing={isEditing}
                index={index}
              >
                {id === 'archives' ? (
                  <NotesPreview onNavigate={onNavigate} />
                ) : (
                  <widget.component />
                )}
              </DashboardWidget>
            );
          })}
        </SortableContext>
      </div>
    </DndContext>
  );
};

export default DraggableDashboard;
