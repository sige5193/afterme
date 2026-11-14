<?php

namespace App\Http\Requests\Api;

use App\Rules\MaxChars;
use Illuminate\Foundation\Http\FormRequest;

class StoreGroupOfferingRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'items' => ['required', 'array', 'min:1'],
            'items.*' => ['integer', 'min:1', 'max:99'],
            'message' => ['nullable', 'string', new MaxChars(120)],
            'from_name' => ['nullable', 'string', new MaxChars(12)],
            'tomb_code' => ['nullable', 'string', 'exists:tombs,code'],
        ];
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($validator) {
            $items = $this->input('items', []);
            if (! is_array($items)) {
                return;
            }
            $allowed = config('afterme.items', []);
            foreach (array_keys($items) as $key) {
                if (! in_array($key, $allowed, true)) {
                    $validator->errors()->add('items', '未知的纸扎');
                }
            }
        });
    }
}
