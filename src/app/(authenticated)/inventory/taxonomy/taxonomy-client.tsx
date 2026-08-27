'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Category, Brand } from '@/generated/prisma/client';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  createCategory,
  updateCategory,
  deleteCategory,
  createBrand,
  updateBrand,
  deleteBrand,
} from '@/lib/inventory/taxonomy-actions';

interface TaxonomyClientProps {
  initialCategories: Category[];
  initialBrands: Brand[];
}

export function TaxonomyClient({
  initialCategories,
  initialBrands,
}: TaxonomyClientProps) {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<'categories' | 'brands'>(
    'categories'
  );

  // Form states
  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const items = activeTab === 'categories' ? initialCategories : initialBrands;

  function openCreate() {
    setIsEditing(false);
    setEditId(null);
    setName('');
    setError(null);
    setIsOpen(true);
  }

  function openEdit(item: { id: string; name: string }) {
    setIsEditing(true);
    setEditId(item.id);
    setName(item.name);
    setError(null);
    setIsOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsPending(true);

    try {
      if (activeTab === 'categories') {
        if (isEditing && editId) {
          await updateCategory(editId, { name });
        } else {
          await createCategory({ name });
        }
      } else {
        if (isEditing && editId) {
          await updateBrand(editId, { name });
        } else {
          await createBrand({ name });
        }
      }
      setIsOpen(false);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsPending(false);
    }
  }

  async function handleDelete(id: string) {
    if (
      !confirm(
        `Are you sure you want to delete this ${activeTab === 'categories' ? 'category' : 'brand'}?`
      )
    )
      return;

    try {
      if (activeTab === 'categories') {
        await deleteCategory(id);
      } else {
        await deleteBrand(id);
      }
      router.refresh();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'An error occurred');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex border-b">
        <button
          className={`px-4 py-2 font-medium ${activeTab === 'categories' ? 'border-b-2 border-black text-black' : 'text-gray-500'}`}
          onClick={() => setActiveTab('categories')}
        >
          Categories
        </button>
        <button
          className={`px-4 py-2 font-medium ${activeTab === 'brands' ? 'border-b-2 border-black text-black' : 'text-gray-500'}`}
          onClick={() => setActiveTab('brands')}
        >
          Brands
        </button>
      </div>

      <div className="flex justify-end">
        <Button onClick={openCreate}>
          Add {activeTab === 'categories' ? 'Category' : 'Brand'}
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={3}
                  className="text-muted-foreground text-center"
                >
                  No {activeTab} found.
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell>{item.createdAt.toLocaleDateString()}</TableCell>
                  <TableCell className="space-x-2 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEdit(item)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600"
                      onClick={() => handleDelete(item.id)}
                    >
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card w-full max-w-md rounded-lg p-6 shadow-lg">
            <h3 className="mb-4 text-lg font-bold">
              {isEditing ? 'Edit' : 'New'}{' '}
              {activeTab === 'categories' ? 'Category' : 'Brand'}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded bg-red-50 p-2 text-sm text-red-600">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium">Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="border-input flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsOpen(false)}
                  disabled={isPending}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
