<?php

namespace App\Http\Requests\Api;

use App\Rules\MaxChars;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateGroupRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['sometimes', 'string', new MaxChars(12)],
            'relation' => ['sometimes', Rule::in(array_keys(config('afterme.relations', [])))],
        ];
    }
}
