<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class PulseRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'since' => ['nullable', 'date'],
            'mode' => ['required', Rule::in(['ghost', 'coffin', 'living'])],
            'plot' => ['nullable', 'integer', 'min:0'],
            'viewing_tomb_id' => ['nullable', 'integer', 'exists:tombs,id'],
        ];
    }
}
